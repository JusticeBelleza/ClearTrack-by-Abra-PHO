// src/types/processing.ts

export interface DocumentLog {
    action: string;
    created_at: string;
}

export interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    status: string;
    assigned_clerk?: string;
    created_by?: string;
    remarks?: string;
    is_urgent?: boolean;
    current_location?: string;
    final_destination?: string;
    attachment_url?: string;
    created_at: string;
    updated_at?: string;
    document_logs?: DocumentLog[];
    action_time?: string; 
    category?: string;
    creator_name?: string;
}

export interface DepartmentOption {
    label: string;
    value: string;
}

export interface SelectOption { 
    label: string; 
    value: string; 
}

export type OptionType = SelectOption | string;

export interface ProcessingData {
    processing: DocumentItem[];
    returned: DocumentItem[];
    departments: DepartmentOption[];
    currentUserName: string;
    currentUserId: string;
    colleagues: string[];
    allEmployeesList: OptionType[];
}