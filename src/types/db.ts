// Hand-written DB types mirroring supabase/migrations.
// Regenerate with `supabase gen types` after provisioning if the schema changes.

export type UserRole = 'cashier' | 'press' | 'admin';
export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
export type DesignType = 'big' | 'small';
export type OrderStatus = 'new' | 'in_progress' | 'ready' | 'completed';

export interface EventRow {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Staff {
  id: string;
  name: string;
  role: UserRole;
  is_active: boolean;
}

export interface Design {
  id: string;
  event_id: string;
  name: string;
  type: DesignType;
  photo_front: string | null;
  photo_back: string | null;
  compatible_colors: string[];
  created_at: string;
}

export interface Order {
  id: string;
  event_id: string;
  event_order_no: number;
  created_at: string;
  shirt_color: string;
  shirt_size: ShirtSize;
  design_front_id: string | null;
  design_back_id: string | null;
  client_name: string | null;
  status: OrderStatus;
  created_by: string | null;
  cashier_key: string | null;
  cashier_name: string | null;
  claimed_by: string | null;
  new_at: string;
  in_progress_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
}

export interface OrderStats {
  event_id: string;
  event_name: string;
  total_orders: number;
  count_new: number;
  count_in_progress: number;
  count_ready: number;
  count_completed: number;
  avg_secs_to_ready: number | null;
  avg_secs_to_complete: number | null;
}
