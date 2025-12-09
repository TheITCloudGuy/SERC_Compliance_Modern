import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

interface StoreData {
    isEnrolled: boolean
    userEmail: string
    userName: string
    enrollmentCode: string
}

const defaultData: StoreData = {
    isEnrolled: false,
    userEmail: '',
    userName: '',
    enrollmentCode: ''
}

let storePath: string = ''
let data: StoreData = { ...defaultData }

/**
 * Initialize the store - must be called after app is ready
 */
export function initStore(): void {
    const userDataPath = app.getPath('userData')
    storePath = join(userDataPath, 'enrollment.json')

    // Ensure directory exists
    if (!existsSync(userDataPath)) {
        mkdirSync(userDataPath, { recursive: true })
    }

    // Load existing data
    if (existsSync(storePath)) {
        try {
            const fileContent = readFileSync(storePath, 'utf-8')
            data = { ...defaultData, ...JSON.parse(fileContent) }
        } catch (error) {
            console.error('Failed to load store:', error)
            data = { ...defaultData }
        }
    }
}

/**
 * Get a value from the store
 */
export function get<K extends keyof StoreData>(key: K): StoreData[K]
export function get<K extends keyof StoreData>(key: K, defaultValue: StoreData[K]): StoreData[K]
export function get<K extends keyof StoreData>(key: K, defaultValue?: StoreData[K]): StoreData[K] {
    const value = data[key]
    if (value === undefined || value === null || value === '') {
        return defaultValue ?? defaultData[key]
    }
    return value
}

/**
 * Set a value in the store
 */
export function set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    data[key] = value
    save()
}

/**
 * Save the store to disk
 */
function save(): void {
    try {
        writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
        console.error('Failed to save store:', error)
    }
}
