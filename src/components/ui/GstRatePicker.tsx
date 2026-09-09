import { useState } from 'react';
import { View } from 'react-native';
import { Select } from './Select';
import { TextField } from './TextField';

/** Standard Indian GST rate slabs — ported from lib/gstRates.ts. */
const GST_RATES = [0, 5, 12, 18, 28] as const;
const GST_RATE_OTHER = -1;

function isStandardGstRate(rate: number): boolean {
  return (GST_RATES as readonly number[]).includes(rate);
}

function gstRateOptions(currentRate?: number): number[] {
  const base = [...GST_RATES];
  if (currentRate != null && Number.isFinite(currentRate) && currentRate >= 0 && !isStandardGstRate(currentRate)) {
    return [...base, currentRate].sort((a, b) => a - b);
  }
  return base;
}

interface GstRatePickerProps {
  value: number;
  onChange: (rate: number) => void;
  label?: string;
}

/**
 * Ports components/GstRatePicker.tsx: a locked dropdown of the standard
 * slabs (0/5/12/18/28%) plus an "Other…" entry that reveals a free-form
 * number field. Used by Receipts' create/edit forms.
 */
export function GstRatePicker({ value, onChange, label = 'GST rate %' }: GstRatePickerProps) {
  const [otherMode, setOtherMode] = useState(() => !isStandardGstRate(value));
  const options = gstRateOptions(value).map((r) => ({ label: `${r}%`, value: String(r) }));
  options.push({ label: 'Other…', value: String(GST_RATE_OTHER) });

  return (
    <View>
      <Select
        label={label}
        value={otherMode ? String(GST_RATE_OTHER) : String(value)}
        options={options}
        onChange={(v) => {
          const n = Number(v);
          if (n === GST_RATE_OTHER) {
            setOtherMode(true);
            return;
          }
          setOtherMode(false);
          onChange(n);
        }}
      />
      {otherMode ? (
        <TextField
          label="Enter rate %"
          value={value ? String(value) : ''}
          onChangeText={(t) => onChange(Number(t) || 0)}
          keyboardType="numeric"
          placeholder="0"
        />
      ) : null}
    </View>
  );
}
