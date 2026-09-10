import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Menu, Settings as SettingsIcon, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { api, type Company } from '../../lib/api';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Card } from '../../components/ui/Card';
import { colors, spacing, fontSize, radius } from '../../theme/tokens';

type Policy = 'allow' | 'block';

/**
 * Ports pages/Settings.tsx — tenant-level configuration. Was entirely
 * missing from the RN app (found during a full audit against the web
 * app) despite the underlying API (`myCompany`/`updateMyCompany` and
 * `Company`'s `negative_stock_policy`/`fg_cover_days`/
 * `fg_history_days` fields) already existing — purely a missing
 * screen, not missing plumbing. No role restriction on the web
 * version's `/settings` route, so none here either — every logged-in
 * user can reach this screen, same as web.
 */
export default function SettingsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { company } = await api.myCompany();
      setCompany(company);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function setPolicy(newPolicy: Policy) {
    if (!company) return;
    setError(''); setMsg(''); setBusy(true);
    try {
      const { company: updated } = await api.updateMyCompany({ negative_stock_policy: newPolicy });
      setCompany(updated);
      setMsg(`Policy updated to "${newPolicy}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.openDrawer()} hitSlop={12}>
          <Menu size={22} color={colors.textStrong} />
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>
      {company ? <Text style={styles.subtitle}>Tenant-level configuration for {company.name}.</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : !company ? (
        <View style={{ padding: spacing[4] }}>
          <ErrorBanner message={error || 'Could not load settings.'} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing[4] }}>
          {error ? <ErrorBanner message={error} /> : null}
          {msg ? (
            <View style={styles.msgBanner}>
              <CheckCircle2 size={16} color={colors.success700} />
              <Text style={styles.msgBannerText}>{msg}</Text>
            </View>
          ) : null}

          <Card style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <SettingsIcon size={14} color={colors.accent} />
              <Text style={styles.sectionTitle}>Negative stock policy</Text>
            </View>
            <Text style={styles.sectionHint}>
              What happens when a production run would consume more raw material than you have in stock?
            </Text>

            <PolicyOption
              title="Allow with warning"
              description="The run proceeds even if RM stock goes negative. A warning is shown. Recommended for factories that record production faster than receipts."
              selected={(company.negative_stock_policy || 'allow') === 'allow'}
              onPress={() => setPolicy('allow')}
              busy={busy}
            />
            <PolicyOption
              title="Block the run"
              description="The run is rejected with an error listing which RMs are short. Use this if your stock records must always match physical reality."
              selected={(company.negative_stock_policy || 'allow') === 'block'}
              onPress={() => setPolicy('block')}
              busy={busy}
              warn
            />
          </Card>

          <FgRestockSettings
            coverDays={company.fg_cover_days ?? 7}
            historyDays={company.fg_history_days ?? 90}
            onSaved={(c) => { setCompany(c); setMsg('FG restock settings updated.'); setError(''); }}
            onError={(m) => { setError(m); setMsg(''); }}
          />
        </ScrollView>
      )}
    </View>
  );
}

function PolicyOption({
  title, description, selected, onPress, busy, warn,
}: {
  title: string; description: string; selected: boolean; onPress: () => void; busy: boolean; warn?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || selected}
      style={[styles.policyOption, selected && styles.policyOptionSelected, busy && !selected && { opacity: 0.5 }]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.policyTitleRow}>
          <Text style={styles.policyTitle}>{title}</Text>
          {selected ? <Text style={styles.policyCurrent}>· CURRENT</Text> : null}
        </View>
        <Text style={styles.policyDescription}>{description}</Text>
      </View>
      {warn && !selected ? <AlertCircle size={14} color={colors.warning700} /> : null}
    </Pressable>
  );
}

function FgRestockSettings({
  coverDays, historyDays, onSaved, onError,
}: {
  coverDays: number;
  historyDays: number;
  onSaved: (c: Company) => void;
  onError: (msg: string) => void;
}) {
  const [cover, setCover] = useState(String(coverDays));
  const [history, setHistory] = useState(String(historyDays));
  const [busy, setBusy] = useState(false);

  useEffect(() => { setCover(String(coverDays)); }, [coverDays]);
  useEffect(() => { setHistory(String(historyDays)); }, [historyDays]);

  const dirty = Number(cover) !== coverDays || Number(history) !== historyDays;

  async function save() {
    const c = Number(cover) || 0;
    const h = Number(history) || 0;
    if (c < 0 || c > 365) return onError('Cover days must be 0–365');
    if (h < 7 || h > 730) return onError('History days must be 7–730');
    setBusy(true);
    try {
      const { company } = await api.updateMyCompany({ fg_cover_days: c, fg_history_days: h });
      onSaved(company);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SettingsIcon size={14} color={colors.accent} />
        <Text style={styles.sectionTitle}>Finished product restock thresholds</Text>
      </View>
      <Text style={styles.sectionHint}>
        The Stock Alerts page flags an FG as low when current stock &lt; avg daily sales × cover days. Average is
        computed over the history window.
      </Text>

      <TextField label="Cover days" value={cover} onChangeText={setCover} keyboardType="numeric" />
      <Text style={styles.fieldHint}>Days of stock buffer to maintain (0–365).</Text>
      <TextField label="History window (days)" value={history} onChangeText={setHistory} keyboardType="numeric" />
      <Text style={styles.fieldHint}>Sales lookback for the average (7–730).</Text>

      <Button label={busy ? 'Saving…' : 'Save thresholds'} onPress={save} loading={busy} disabled={!dirty} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[4], paddingBottom: spacing[1] },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textStrong },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing[4], marginBottom: spacing[1] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.success50, borderWidth: 1, borderColor: colors.success700,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3],
  },
  msgBannerText: { fontSize: fontSize.sm, color: colors.success700, flex: 1 },
  section: { marginBottom: spacing[3] },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textStrong },
  sectionHint: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing[3], lineHeight: 17 },
  policyOption: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2],
  },
  policyOptionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  radioOuter: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOuterSelected: { borderColor: colors.accent },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  policyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  policyTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textStrong },
  policyCurrent: { fontSize: 11, color: colors.accentStrong, fontWeight: '700' },
  policyDescription: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  fieldHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: -spacing[2], marginBottom: spacing[3] },
});