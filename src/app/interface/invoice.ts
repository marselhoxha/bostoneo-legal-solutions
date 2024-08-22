export interface Invoice {
    id: number;
    invoiceNumber: number;
    services: string;
    status: string;
    total: number;
    createdAt: Date;
}