import { Invoice } from "./invoice";

export interface Client {
    id: number;
    name: string;
    email: string;
    address: string;
    type: string;
    status: string;
    imageUrl: string;
    phone: string;
    createdAt: Date;
    aiConsentGiven?: boolean;
    aiConsentDate?: Date;
    aiConsentNotes?: string;
    invoices?: Invoice[];
}