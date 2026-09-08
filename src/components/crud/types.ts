import type { SelectOption } from '../ui/Select';

export type FieldType = 'text' | 'number' | 'select' | 'switch' | 'textarea';

export interface FieldConfig<TInput> {
  key: keyof TInput & string;
  label: string;
  type: FieldType;
  options?: SelectOption<string>[]; // required when type === 'select'
  required?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  placeholder?: string;
  /** Only show this field on create, or only on edit — omit for "always". */
  showOn?: 'create' | 'edit';
}
