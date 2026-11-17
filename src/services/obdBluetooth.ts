import {
  cleanElmResponse,
  computeFuelMetrics,
  decodeDtcResponse,
  decodeMode01Pid,
  decodePid01Status,
  extractMode01Bytes,
} from './obdProtocol';
import { ReadinessMonitor, TelemetryFrame, VehicleMeta } from '../types/obd';

// Standard BLE GATT Service UUIDs used by ELM327-compatible Bluetooth Low Energy OBD-II adapters
export const OBD_BLE_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb', // Veepeak, Vgate iCar Pro BLE, generic ELM327 BLE
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / transparent BLE UART
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip ISSC UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // OBDLink CX / LX BLE
];

interface WebBluetoothCharacteristic {
  uuid: string;
  properties: {
    notify: boolean;
    indicate: boolean;
    write: boolean;
    writeWithoutResponse: boolean;
  };
  startNotifications(): Promise<WebBluetoothCharacteristic>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  writeValue?(value: BufferSource): Promise<void>;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

interface WebBluetoothService {
  uuid: string;
  getCharacteristics(): Promise<WebBluetoothCharacteristic[]>;
}

interface WebBluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<WebBluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<WebBluetoothService>;
  getPrimaryServices(): Promise<WebBluetoothService[]>;
}

interface WebBluetoothDevice {
  id: string;
  name?: string;
  gatt?: WebBluetoothRemoteGATTServer;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface WebBluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ services?: string[]; namePrefix?: string }>;
      optionalServices?: string[];
      acceptAllDevices?: boolean;
    }): Promise<WebBluetoothDevice>;
  };
}

export interface BluetoothCallbacks {
  onLog: (direction: 'tx' | 'rx' | 'info' | 'error', message: string, decoded?: string) => void;
  onFrame: (frame: TelemetryFrame) => void;
  onMetaUpdate: (meta: Partial<VehicleMeta>) => void;
  onDisconnect: (reason?: string) => void;
}

export function isWebBluetoothSupported(): boolean {
  const nav = navigator as WebBluetoothNavigator;
  return typeof navigator !== 'undefined' && typeof nav.bluetooth?.requestDevice === 'function';
}

export class ObdBluetoothClient {
  private device: WebBluetoothDevice | null = null;
  private rxChar: WebBluetoothCharacteristic | null = null;
  private txChar: WebBluetoothCharacteristic | null = null;
  private buffer = '';
  private pendingResolve: ((response: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private pendingTimer: number | null = null;
  private commandQueue: Promise<unknown> = Promise.resolve();
  private pollingActive = false;
  private pollTimer: number | null = null;
  private callbacks: BluetoothCallbacks;

  private lastState: Omit<TelemetryFrame, 'timestamp' | 'fuelFlowLh' | 'instantL100km' | 'instantMpg' | 'co2Gkm'> = {
    rpm: 0,
    speedKmh: 0,
    coolantTempC: 85,
    intakeTempC: 28,
    engineLoadPct: 0,
    throttlePct: 0,
    mafGs: 0,
    mapKpa: 32,
    stftPct: 0,
    ltftPct: 0,
    voltageV: 12.6,
    fuelLevelPct: 65,
    gearEstimate: 0,
  };

  private displacementL = 2.0;
  private fuelType: 'gasoline' | 'diesel' = 'gasoline';

  constructor(callbacks: BluetoothCallbacks) {
    this.callbacks = callbacks;
  }

  public setVehicleProfile(displacementL: number, fuelType: 'gasoline' | 'diesel') {
    this.displacementL = displacementL;
    this.fuelType = fuelType;
  }

  private handleNotification = (event: Event) => {
    const target = event.target as unknown as { value?: DataView };
    if (!target?.value) return;

    const decoder = new TextDecoder('utf-8');
    const chunk = decoder.decode(target.value);
    this.buffer += chunk;

    if (this.buffer.includes('>')) {
      const fullResponse = this.buffer.split('>')[0].trim();
      this.buffer = '';
      if (this.pendingTimer !== null) {
        window.clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
      }
      if (this.pendingResolve) {
        const resolve = this.pendingResolve;
        this.pendingResolve = null;
        this.pendingReject = null;
        resolve(fullResponse);
      }
    }
  };

  private handleGattDisconnected = () => {
    this.stopPolling();
    this.callbacks.onLog('info', 'Bluetooth GATT connection closed by adapter or vehicle.');
    this.callbacks.onDisconnect('Bluetooth device disconnected');
  };

  public async connect(acceptAll = false): Promise<{ deviceName: string }> {
    const nav = navigator as WebBluetoothNavigator;
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth API is not supported in this browser. Use Chrome/Edge over HTTPS or launch Simulation Mode.');
    }

    this.callbacks.onLog('info', 'Opening Bluetooth adapter picker...');

    const device = await nav.bluetooth.requestDevice(
      acceptAll
        ? {
            acceptAllDevices: true,
            optionalServices: OBD_BLE_SERVICES,
          }
        : {
            filters: [
              ...OBD_BLE_SERVICES.map((svc) => ({ services: [svc] })),
              { namePrefix: 'OBD' },
              { namePrefix: 'Veepeak' },
              { namePrefix: 'Vgate' },
              { namePrefix: 'IOS-Vlink' },
              { namePrefix: 'ELM327' },
              { namePrefix: 'OBDLink' },
            ],
            optionalServices: OBD_BLE_SERVICES,
          }
    );

    this.device = device;
    this.device.addEventListener('gattserverdisconnected', this.handleGattDisconnected);

    if (!device.gatt) {
      throw new Error('Selected Bluetooth device does not expose a GATT server.');
    }

    this.callbacks.onLog('info', `Connecting GATT to ${device.name || 'OBD-II Adapter'}...`);
    const server = await device.gatt.connect();

    const services = await server.getPrimaryServices();
    let foundTx: WebBluetoothCharacteristic | null = null;
    let foundRx: WebBluetoothCharacteristic | null = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const ch of chars) {
        if (!foundRx && (ch.properties.notify || ch.properties.indicate)) {
          foundRx = ch;
        }
        if (!foundTx && (ch.properties.write || ch.properties.writeWithoutResponse)) {
          foundTx = ch;
        }
      }
      if (foundTx && foundRx) break;
    }

    if (!foundTx || !foundRx) {
      throw new Error(
        'Compatible UART write/notify GATT characteristics were not found on this Bluetooth device. Ensure this is a BLE (4.0+) OBD-II adapter.'
      );
    }

    this.txChar = foundTx;
    this.rxChar = foundRx;

    await this.rxChar.startNotifications();
    this.rxChar.addEventListener('characteristicvaluechanged', this.handleNotification);

    const deviceName = device.name || 'ELM327 BLE Adapter';
    this.callbacks.onMetaUpdate({ deviceName });
    this.callbacks.onLog('info', `Connected to ${deviceName}. Initializing ELM327 protocol...`);

    await this.initializeElm327();
    return { deviceName };
  }

  public sendCommand(cmd: string, timeoutMs = 2800): Promise<string> {
    const task = this.commandQueue.then(
      () =>
        new Promise<string>((resolve, reject) => {
          if (!this.txChar || !this.device?.gatt?.connected) {
            reject(new Error('Bluetooth adapter is not connected'));
            return;
          }

          this.buffer = '';
          this.pendingResolve = resolve;
          this.pendingReject = reject;

          this.pendingTimer = window.setTimeout(() => {
            this.pendingResolve = null;
            this.pendingReject = null;
            reject(new Error(`Timeout waiting for adapter response to "${cmd}"`));
          }, timeoutMs);

          const encoded = new TextEncoder().encode(`${cmd.trim()}\r`);
          this.callbacks.onLog('tx', cmd.trim());

          const writePromise = this.txChar.writeValueWithoutResponse
            ? this.txChar.writeValueWithoutResponse(encoded)
            : this.txChar.writeValueWithResponse
              ? this.txChar.writeValueWithResponse(encoded)
              : this.txChar.writeValue?.(encoded);

          if (!writePromise) {
            reject(new Error('Characteristic does not support GATT write'));
            return;
          }

          writePromise.catch((err) => {
            if (this.pendingTimer !== null) {
              window.clearTimeout(this.pendingTimer);
              this.pendingTimer = null;
            }
            this.pendingResolve = null;
            this.pendingReject = null;
            reject(err instanceof Error ? err : new Error(String(err)));
          });
        })
    );

    this.commandQueue = task.catch(() => {});
    return task.then((raw) => {
      this.callbacks.onLog('rx', raw || '(empty)');
      return raw;
    });
  }

  private async initializeElm327() {
    const initCmds = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];
    for (const cmd of initCmds) {
      try {
        await this.sendCommand(cmd, cmd === 'ATZ' ? 4000 : 2500);
      } catch (err) {
        this.callbacks.onLog('error', `Init warning on ${cmd}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
      const proto = await this.sendCommand('ATDP');
      const cleanedProto = cleanElmResponse(proto).join(' ') || 'Auto CAN (ISO 15765-4)';
      this.callbacks.onMetaUpdate({ protocol: cleanedProto });
    } catch {
      this.callbacks.onMetaUpdate({ protocol: 'ISO 15765-4 (CAN)' });
    }

    try {
      const vinResp = await this.sendCommand('0902', 3500);
      const hex = vinResp.replace(/[^0-9A-Fa-f]/g, '');
      if (hex.length >= 34) {
        let vin = '';
        for (let i = 0; i + 1 < hex.length; i += 2) {
          const code = parseInt(hex.slice(i, i + 2), 16);
          if (code >= 48 && code <= 90) vin += String.fromCharCode(code);
        }
        if (vin.length >= 11) {
          this.callbacks.onMetaUpdate({ vin: vin.slice(-17) });
        }
      }
    } catch {
      // Optional PID 0902 may be unsupported on older vehicles
    }
  }

  public async scanDiagnostics(): Promise<{
    storedCodes: string[];
    pendingCodes: string[];
    milOn: boolean;
    monitors: ReadinessMonitor[];
  }> {
    let milOn = false;
    let monitors: ReadinessMonitor[] = [];

    try {
      const pid01Raw = await this.sendCommand('0101');
      for (const line of cleanElmResponse(pid01Raw)) {
        const bytes = extractMode01Bytes(line, '01');
        if (bytes && bytes.length >= 4) {
          const decoded = decodePid01Status(bytes);
          milOn = decoded.milOn;
          monitors = decoded.monitors;
          this.callbacks.onMetaUpdate({ milOn, dtcCountFromMil: decoded.dtcCount });
          break;
        }
      }
    } catch {
      // Continue to Mode 03/07 even if 0101 fails
    }

    const storedRaw = await this.sendCommand('03', 3500);
    const storedCodes = decodeDtcResponse(storedRaw, '43');

    let pendingCodes: string[] = [];
    try {
      const pendingRaw = await this.sendCommand('07', 3500);
      pendingCodes = decodeDtcResponse(pendingRaw, '47');
    } catch {
      pendingCodes = [];
    }

    return { storedCodes, pendingCodes, milOn, monitors };
  }

  public async clearDtcs(): Promise<void> {
    await this.sendCommand('04', 4000);
    this.callbacks.onMetaUpdate({ milOn: false, dtcCountFromMil: 0 });
  }

  public startPolling() {
    if (this.pollingActive) return;
    this.pollingActive = true;

    const fastPids = ['010C', '010D', '0111', '0104', '0110'];
    const slowPids = ['0105', '010B', '010F', '0106', '0107', '0142', '012F'];
    let cycle = 0;

    const tick = async () => {
      if (!this.pollingActive || !this.device?.gatt?.connected) return;

      const batch = [...fastPids];
      batch.push(slowPids[cycle % slowPids.length]);
      cycle++;

      for (const pidCmd of batch) {
        if (!this.pollingActive) break;
        const pidHex = pidCmd.slice(2, 4);
        try {
          const resp = await this.sendCommand(pidCmd, 1800);
          for (const line of cleanElmResponse(resp)) {
            const bytes = extractMode01Bytes(line, pidHex);
            if (!bytes) continue;
            const parsed = decodeMode01Pid(pidHex, bytes);
            if (!parsed || typeof parsed.value !== 'number') continue;

            switch (pidHex) {
              case '0C':
                this.lastState.rpm = parsed.value;
                break;
              case '0D':
                this.lastState.speedKmh = parsed.value;
                break;
              case '05':
                this.lastState.coolantTempC = parsed.value;
                break;
              case '04':
                this.lastState.engineLoadPct = parsed.value;
                break;
              case '11':
                this.lastState.throttlePct = parsed.value;
                break;
              case '10':
                this.lastState.mafGs = parsed.value;
                break;
              case '0B':
                this.lastState.mapKpa = parsed.value;
                break;
              case '0F':
                this.lastState.intakeTempC = parsed.value;
                break;
              case '06':
                this.lastState.stftPct = parsed.value;
                break;
              case '07':
                this.lastState.ltftPct = parsed.value;
                break;
              case '42':
                this.lastState.voltageV = parsed.value;
                break;
              case '2F':
                this.lastState.fuelLevelPct = parsed.value;
                break;
            }
          }
        } catch {
          // Skip transient PID timeout and proceed
        }
      }

      const fuel = computeFuelMetrics({
        rpm: this.lastState.rpm,
        speedKmh: this.lastState.speedKmh,
        mafGs: this.lastState.mafGs,
        mapKpa: this.lastState.mapKpa,
        intakeTempC: this.lastState.intakeTempC,
        stftPct: this.lastState.stftPct,
        ltftPct: this.lastState.ltftPct,
        displacementL: this.displacementL,
        fuelType: this.fuelType,
      });

      const gearEstimate =
        this.lastState.speedKmh < 3
          ? 0
          : Math.min(6, Math.max(1, Math.round(this.lastState.speedKmh / Math.max(12, this.lastState.rpm / 120))));

      this.callbacks.onFrame({
        timestamp: Date.now(),
        ...this.lastState,
        gearEstimate,
        ...fuel,
      });

      if (this.pollingActive) {
        this.pollTimer = window.setTimeout(tick, 120);
      }
    };

    tick();
  }

  public stopPolling() {
    this.pollingActive = false;
    if (this.pollTimer !== null) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public disconnect() {
    this.stopPolling();
    if (this.pendingTimer !== null) {
      window.clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.pendingReject) {
      this.pendingReject(new Error('Disconnected by user'));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
    if (this.rxChar) {
      this.rxChar.removeEventListener('characteristicvaluechanged', this.handleNotification);
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleGattDisconnected);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    }
    this.device = null;
    this.rxChar = null;
    this.txChar = null;
  }
}
