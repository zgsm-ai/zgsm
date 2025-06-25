import * as crypto from "crypto"
import * as vscode from "vscode"

// It's better to have a constant salt.
const SALT = "zgsm-salt-for-token-encryption"
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const KEY_LENGTH = 32

// Store derived key in memory to avoid re-deriving it on every call
let derivedKey: Buffer | null = null

async function getKey(): Promise<Buffer> {
	if (derivedKey) {
		return derivedKey
	}
	// Use scrypt to derive a key from the machine ID. It's more secure than just hashing.
	return new Promise((resolve, reject) => {
		crypto.scrypt(vscode.env.machineId, SALT, KEY_LENGTH, (err, key) => {
			if (err) {
				reject(err)
				return
			}
			derivedKey = key
			resolve(key)
		})
	})
}

export async function encrypt(text: string): Promise<string> {
	const key = await getKey()
	const iv = crypto.randomBytes(IV_LENGTH)
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
	const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
	const authTag = cipher.getAuthTag()

	// Store iv, authTag, and encrypted data together, separated by a character that won't appear in hex.
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

export async function decrypt(encryptedText: string): Promise<string> {
	const key = await getKey()
	const parts = encryptedText.split(":")
	if (parts.length !== 3) {
		throw new Error("Invalid encrypted text format.")
	}
	const [ivHex, authTagHex, encryptedDataHex] = parts

	const iv = Buffer.from(ivHex, "hex")
	const authTag = Buffer.from(authTagHex, "hex")
	const encryptedData = Buffer.from(encryptedDataHex, "hex")

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
	decipher.setAuthTag(authTag)

	const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
	return decrypted.toString("utf8")
}
