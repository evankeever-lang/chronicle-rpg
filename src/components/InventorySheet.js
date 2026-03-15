import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGame } from '../context/GameContext';
import { getAbilityModifier } from '../utils/dice';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

const ITEM_TYPE_ICON = {
  weapon: '🗡',
  armor: '🛡',
  consumable: '🧪',
  quest: '🔑',
  misc: '📦',
};

const FILTER_OPTIONS = ['All', 'Weapons', 'Armor', 'Consumables', 'Quest', 'Misc'];
const FILTER_TYPE_MAP = {
  Weapons: 'weapon', Armor: 'armor', Consumables: 'consumable', Quest: 'quest', Misc: 'misc',
};

const EQUIPMENT_SLOTS = [
  { key: 'mainHand', label: 'Main Hand' },
  { key: 'offHand', label: 'Off Hand' },
  { key: 'chest', label: 'Chest' },
  { key: 'head', label: 'Head' },
  { key: 'hands', label: 'Hands' },
  { key: 'feet', label: 'Feet' },
  { key: 'amulet', label: 'Amulet' },
  { key: 'ring1', label: 'Ring 1' },
  { key: 'ring2', label: 'Ring 2' },
];

export default function InventorySheet({ visible, onClose }) {
  const { character, equipment = {}, removeItem, equipItem, unequipItem } = useGame();
  const [filter, setFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);

  const inventory = character?.inventory || [];
  const gold = character?.gold || 0;
  const strMod = getAbilityModifier(character?.abilityScores?.STR || 10);
  const maxCarry = ((character?.abilityScores?.STR || 10) * 15);
  const currentWeight = inventory.reduce((sum, i) => sum + ((i.weight || 1) * (i.quantity || 1)), 0);
  const weightPct = Math.min(1, currentWeight / maxCarry);
  const isOverWeight = currentWeight > maxCarry;

  const filteredItems = filter === 'All'
    ? inventory
    : inventory.filter(i => i.type === FILTER_TYPE_MAP[filter]);

  const equippedItemIds = new Set(Object.values(equipment).filter(Boolean));

  const handleDrop = (item) => {
    if (item.type === 'quest') return;
    Alert.alert('Drop item?', `Drop ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Drop', style: 'destructive', onPress: () => { removeItem(item.id); setSelectedItem(null); } },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Inventory</Text>
              <Text style={[styles.headerWeight, isOverWeight && styles.headerWeightOver]}>
                ⚖ {currentWeight} / {maxCarry} lbs
              </Text>
              <View style={styles.weightBar}>
                <View style={[styles.weightFill, { width: `${weightPct * 100}%`, backgroundColor: isOverWeight ? COLORS.danger : COLORS.primary }]} />
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.goldText}>🪙 {gold} gp</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Equipped ── */}
            <Text style={styles.sectionLabel}>EQUIPPED</Text>
            {EQUIPMENT_SLOTS.map(slot => {
              const itemId = equipment[slot.key];
              const item = itemId ? inventory.find(i => i.id === itemId) : null;
              return (
                <View key={slot.key} style={styles.equipRow}>
                  <Text style={styles.equipSlotLabel}>{slot.label}</Text>
                  {item ? (
                    <>
                      <Text style={styles.equipItemName}>{item.name}</Text>
                      <TouchableOpacity onPress={() => unequipItem(item.id, slot.key)} style={styles.unequipBtn}>
                        <Text style={styles.unequipBtnText}>Unequip</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.equipEmpty}>—</Text>
                  )}
                </View>
              );
            })}

            {/* ── Backpack ── */}
            <View style={styles.backpackHeader}>
              <Text style={styles.sectionLabel}>BACKPACK</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {FILTER_OPTIONS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, filter === f && styles.filterChipActive]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {filteredItems.length === 0 && (
              <Text style={styles.emptyText}>No items{filter !== 'All' ? ` in ${filter}` : ' in backpack'}.</Text>
            )}

            {filteredItems.map(item => {
              const icon = ITEM_TYPE_ICON[item.type] || ITEM_TYPE_ICON.misc;
              const isEquipped = equippedItemIds.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemRow, selectedItem?.id === item.id && styles.itemRowSelected]}
                  onPress={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                >
                  <Text style={styles.itemIcon}>{icon}</Text>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {isEquipped && <Text style={styles.itemEquippedBadge}>equipped</Text>}
                    {item.type === 'quest' && <Text style={styles.itemQuestBadge}>quest</Text>}
                  </View>
                  {(item.quantity || 1) > 1 && (
                    <Text style={styles.itemQty}>×{item.quantity}</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* ── Item detail panel ── */}
            {selectedItem && (
              <View style={styles.detailPanel}>
                <Text style={styles.detailName}>{selectedItem.name}</Text>
                <Text style={styles.detailType}>{selectedItem.type || 'misc'} · {selectedItem.weight || 1} lb</Text>
                {!!selectedItem.description && (
                  <Text style={styles.detailDesc}>{selectedItem.description}</Text>
                )}
                <View style={styles.detailActions}>
                  {(selectedItem.type === 'weapon' || selectedItem.type === 'armor') && (
                    <TouchableOpacity
                      style={styles.detailBtn}
                      onPress={() => {
                        const slot = selectedItem.type === 'weapon' ? 'mainHand' : 'chest';
                        equipItem(selectedItem.id, slot);
                        setSelectedItem(null);
                      }}
                    >
                      <Text style={styles.detailBtnText}>Equip</Text>
                    </TouchableOpacity>
                  )}
                  {selectedItem.type !== 'quest' && (
                    <TouchableOpacity style={[styles.detailBtn, styles.detailBtnDanger]} onPress={() => handleDrop(selectedItem)}>
                      <Text style={[styles.detailBtnText, styles.detailBtnDangerText]}>Drop</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View style={{ height: SPACING.xxl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '90%',
    paddingTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end', gap: SPACING.xs },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerWeight: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  headerWeightOver: { color: COLORS.danger },
  weightBar: {
    height: 3,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 2,
    width: '80%',
    overflow: 'hidden',
  },
  weightFill: { height: '100%', borderRadius: 2 },
  goldText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.md,
    color: '#D4860B',
    fontWeight: '700',
  },
  closeBtn: { padding: SPACING.xs },
  closeBtnText: { fontSize: 16, color: COLORS.textMuted },
  sectionLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
  equipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  equipSlotLabel: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    width: 80,
  },
  equipItemName: {
    flex: 1,
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  equipEmpty: {
    flex: 1,
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  unequipBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
  },
  unequipBtnText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  backpackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  filterRow: { flexShrink: 1, marginTop: SPACING.md, paddingRight: SPACING.lg },
  filterChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs,
    backgroundColor: COLORS.surfaceElevated,
  },
  filterChipActive: { backgroundColor: COLORS.primaryFaint, borderColor: COLORS.primary },
  filterChipText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.primary },
  emptyText: {
    fontFamily: FONTS.sansSerif,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderColor: COLORS.surfaceElevated,
    gap: SPACING.sm,
  },
  itemRowSelected: { backgroundColor: COLORS.primaryFaint },
  itemIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  itemInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  itemName: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textPrimary, fontWeight: '500' },
  itemEquippedBadge: {
    fontFamily: FONTS.sansSerif, fontSize: 10, color: COLORS.success,
    backgroundColor: '#0F2B1A', borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 1,
  },
  itemQuestBadge: {
    fontFamily: FONTS.sansSerif, fontSize: 10, color: '#D4860B',
    backgroundColor: '#2B1A0F', borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 1,
  },
  itemQty: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textMuted, fontWeight: '700' },
  detailPanel: {
    margin: SPACING.lg,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailName: { fontFamily: FONTS.serif, fontSize: FONT_SIZES.lg, color: COLORS.textPrimary, fontWeight: '700', marginBottom: 2 },
  detailType: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginBottom: SPACING.sm, textTransform: 'capitalize' },
  detailDesc: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  detailActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  detailBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryFaint, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center',
  },
  detailBtnText: { fontFamily: FONTS.sansSerif, fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '700' },
  detailBtnDanger: { backgroundColor: '#1A0808', borderColor: COLORS.danger },
  detailBtnDangerText: { color: COLORS.danger },
});
