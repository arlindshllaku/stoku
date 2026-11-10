export type IncomingPhone = { id?: number; brand: string; model: string; imei: string; color: string; storage: string; purchase_price: string; selling_price: string }
export const emptyPhone = (): IncomingPhone => ({ brand: '', model: '', imei: '', color: '', storage: '', purchase_price: '', selling_price: '' })
