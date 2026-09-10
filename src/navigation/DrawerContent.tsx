import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ChevronDown, ChevronRight, LogOut, Factory, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { NAV, isGroup, type NavEntry } from './navConfig';
import { colors, spacing, radius, fontSize } from '../theme/tokens';

/**
 * Ports the sidebar from components/Layout.tsx: grouped, collapsible
 * nav with role-based filtering. The web version persisted open-group
 * state to localStorage under 'qmfg.nav.openGroups' — worth adding
 * back with prefsStorage once this stabilizes, skipped for Phase 0 to
 * keep the drawer's first cut simple (starts with all groups closed).
 */
export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function canSee(entry: NavEntry): boolean {
    if (!entry.roles) return true;
    return !!user && entry.roles.includes(user.role);
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Factory size={20} color={colors.accent} />
        </View>
        <Text style={styles.brandName}>TanaBana</Text>
      </View>

      <ScrollView style={styles.nav}>
        {NAV.filter(canSee).map((entry) => {
          if (isGroup(entry)) {
            const open = !!openGroups[entry.groupId];
            const visibleChildren = entry.children.filter(canSee);
            if (visibleChildren.length === 0) return null;
            return (
              <View key={entry.groupId}>
                <Pressable style={styles.groupHeader} onPress={() => toggleGroup(entry.groupId)}>
                  <entry.icon size={18} color={colors.textMuted} />
                  <Text style={styles.groupLabel}>{entry.label}</Text>
                  {open ? (
                    <ChevronDown size={16} color={colors.textMuted} />
                  ) : (
                    <ChevronRight size={16} color={colors.textMuted} />
                  )}
                </Pressable>
                {open &&
                  visibleChildren.map((child) => (
                    <NavItem
                      key={child.screen}
                      entry={child}
                      indent
                      onPress={() => props.navigation.navigate(child.screen)}
                    />
                  ))}
              </View>
            );
          }
          return (
            <NavItem
              key={entry.screen}
              entry={entry}
              onPress={() => props.navigation.navigate(entry.screen)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {user ? (
          <Text style={styles.userLine} numberOfLines={1}>
            {user.name} · {user.role}
          </Text>
        ) : null}
        <Pressable style={styles.logoutButton} onPress={logout}>
          <LogOut size={16} color={colors.error700} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavItem({
  entry,
  indent,
  onPress,
}: {
  entry: { icon: LucideIcon; label: string; implemented?: boolean };
  indent?: boolean;
  onPress: () => void;
}) {
  const Icon = entry.icon;
  return (
    <Pressable style={[styles.item, indent && styles.itemIndent]} onPress={onPress}>
      <Icon size={18} color={colors.text} />
      <Text style={styles.itemLabel}>{entry.label}</Text>
      {!entry.implemented && entry.label !== 'Dashboard' ? (
        <View style={styles.soonBadge}>
          <Text style={styles.soonText}>soon</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: fontSize.lg, fontWeight: '800', color: colors.textStrong },
  nav: { flex: 1, paddingVertical: spacing[2] },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  groupLabel: { flex: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  itemIndent: { paddingLeft: spacing[8] },
  itemLabel: { flex: 1, fontSize: fontSize.base, color: colors.textStrong },
  soonBadge: { backgroundColor: colors.neutral100, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  soonText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: colors.borderSoft, gap: spacing[3] },
  userLine: { fontSize: fontSize.sm, color: colors.textMuted },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  logoutText: { fontSize: fontSize.base, fontWeight: '600', color: colors.error700 },
});