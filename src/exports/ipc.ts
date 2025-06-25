import EventEmitter from "node:events"
import { Socket } from "node:net"
import * as crypto from "node:crypto"

import ipc from "node-ipc"

import { IpcOrigin, IpcMessageType, type IpcMessage, ipcMessageSchema } from "../schemas"
import type { IpcServerEvents, RooCodeIpcServer } from "./interface"

/**
 * IpcServer
 */

export class IpcServer extends EventEmitter<IpcServerEvents> implements RooCodeIpcServer {
	private readonly _socketPath: string
	private readonly _log: (...args: unknown[]) => void
	private readonly _clients: Map<string, Socket>

	private _isListening = false

	constructor(socketPath: string, log = console.log) {
		super()

		this._socketPath = socketPath
		this._log = log
		this._clients = new Map()
	}

	public listen() {
		this._isListening = true

		ipc.config.silent = true

		ipc.serve(this.socketPath, () => {
			ipc.server.on("connect", (socket) => this.onConnect(socket))
			ipc.server.on("socket.disconnected", (socket) => this.onDisconnect(socket))
			ipc.server.on("message", (data) => this.onMessage(data))
		})

		ipc.server.start()
	}

	private onConnect(socket: Socket) {
		const clientId = crypto.randomBytes(6).toString("hex")
		this._clients.set(clientId, socket)
		this.log(`[server#onConnect] clientId = ${clientId}, # clients = ${this._clients.size}`)

		this.send(socket, {
			type: IpcMessageType.Ack,
			origin: IpcOrigin.Server,
			data: { clientId, pid: process.pid, ppid: process.ppid },
		})

		this.emit(IpcMessageType.Connect, clientId)
	}

	private onDisconnect(destroyedSocket: Socket) {
		let disconnectedClientId: string | undefined

		for (const [clientId, socket] of this._clients.entries()) {
			if (socket === destroyedSocket) {
				disconnectedClientId = clientId
				this._clients.delete(clientId)
				break
			}
		}

		this.log(`[server#socket.disconnected] clientId = ${disconnectedClientId}, # clients = ${this._clients.size}`)

		if (disconnectedClientId) {
			this.emit(IpcMessageType.Disconnect, disconnectedClientId)
		}
	}

	private onMessage(data: unknown) {
		if (typeof data !== "object") {
			this.log("[server#onMessage] invalid data", data)
			return
		}

		const result = ipcMessageSchema.safeParse(data)

		if (!result.success) {
			this.log("[server#onMessage] invalid payload", result.error.format(), data)
			return
		}

		const payload = result.data

		if (payload.origin === IpcOrigin.Client) {
			switch (payload.type) {
				case IpcMessageType.TaskCommand:
					this.emit(IpcMessageType.TaskCommand, payload.clientId, payload.data)
					break
				default:
					this.log(`[server#onMessage] unhandled payload: ${JSON.stringify(payload)}`)
					break
			}
		}
	}

	private log(...args: unknown[]) {
		this._log(...args)
	}

	public broadcast(message: IpcMessage) {
		// this.log("[server#broadcast] message =", message)
		ipc.server.broadcast("message", message)
	}

	public send(client: string | Socket, message: IpcMessage) {
		// this.log("[server#send] message =", message)

		if (typeof client === "string") {
			const socket = this._clients.get(client)

			if (socket) {
				ipc.server.emit(socket, "message", message)
			}
		} else {
			ipc.server.emit(client, "message", message)
		}
	}

	public get socketPath() {
		return this._socketPath
	}

	public get isListening() {
		return this._isListening
	}
}

/**
 * IpcClient
 */
import { EventEmitter as NodeEventEmitter } from "node:events"

export class IpcClient extends NodeEventEmitter {
	private readonly _socketPath: string
	private readonly _log: (...args: unknown[]) => void
	private _clientId: string | undefined
	private _isConnected = false

	constructor(socketPath: string, log = console.log) {
		super()
		this._socketPath = socketPath
		this._log = log
		this._setup()
	}

	private _setup() {
		ipc.config.silent = true
		ipc.connectTo(this._socketPath, () => {
			ipc.of[this._socketPath].on("connect", () => {
				this._isConnected = true
				this._log(`[IpcClient] Connected to ${this._socketPath}`)
				this.emit("connect")
			})
			ipc.of[this._socketPath].on("disconnect", () => {
				this._isConnected = false
				this._log(`[IpcClient] Disconnected from ${this._socketPath}`)
				this.emit("disconnect")
			})
			ipc.of[this._socketPath].on("message", (data: any) => {
				this._onMessage(data)
			})
		})
	}

	private _onMessage(data: unknown) {
		this._log("[IpcClient#onMessage]", data)
		this.emit("message", data)
	}

	public send(message: any) {
		if (this._isConnected) {
			ipc.of[this._socketPath].emit("message", message)
		}
	}

	public get isConnected() {
		return this._isConnected
	}

	public dispose() {
		if (ipc.of[this._socketPath]) {
			ipc.disconnect(this._socketPath)
		}
	}
}
