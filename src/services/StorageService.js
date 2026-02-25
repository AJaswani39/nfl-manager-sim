import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEAMS } from '../data/teams';
import { league } from '../engine/LeagueEngine';

const INDEX_KEY = '@nfl_manager_index';
const LEGACY_KEY = '@nfl_manager_save';
const slotKey = (slotId) => `@nfl_manager_save_slot_${slotId}`;

const emptyIndex = () => ({ slots: { 1: null, 2: null, 3: null } });

function buildSlotMeta(slotId, leagueData) {
  const team = TEAMS.find(t => t.id === leagueData.userTeamId);
  return {
    slotId,
    teamId: leagueData.userTeamId,
    teamName: team ? `${team.city} ${team.name}` : 'Unknown Team',
    season: leagueData.season || 1,
    currentWeek: leagueData.currentWeek || 1,
    phase: leagueData.phase || 'preseason',
    lastSaved: Date.now(),
  };
}

export const StorageService = {
  async getSlotIndex() {
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      if (raw !== null) return JSON.parse(raw);
      return await this._migrateAndBuildIndex();
    } catch (error) {
      console.error('Error reading slot index:', error);
      return emptyIndex();
    }
  },

  async _migrateAndBuildIndex() {
    const index = emptyIndex();
    try {
      const legacyRaw = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacyRaw !== null) {
        const data = JSON.parse(legacyRaw);
        index.slots[1] = buildSlotMeta(1, data);
        await AsyncStorage.setItem(slotKey(1), legacyRaw);
      }
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('Error during save migration:', error);
    }
    return index;
  },

  async saveSlot(slotId, leagueData) {
    try {
      await AsyncStorage.setItem(slotKey(slotId), JSON.stringify(leagueData));
      const index = await this.getSlotIndex();
      index.slots[slotId] = buildSlotMeta(slotId, leagueData);
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
      return { success: true };
    } catch (error) {
      console.error('Error saving slot:', error);
      return { success: false, error: error.message };
    }
  },

  async loadSlot(slotId) {
    try {
      const raw = await AsyncStorage.getItem(slotKey(slotId));
      if (raw !== null) return { success: true, data: JSON.parse(raw) };
      return { success: false, error: 'No save in this slot' };
    } catch (error) {
      console.error('Error loading slot:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteSlot(slotId) {
    try {
      await AsyncStorage.removeItem(slotKey(slotId));
      const index = await this.getSlotIndex();
      index.slots[slotId] = null;
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
      return { success: true };
    } catch (error) {
      console.error('Error deleting slot:', error);
      return { success: false, error: error.message };
    }
  },

  // --- Legacy wrappers — all existing call sites continue to work unchanged ---

  async saveGame(leagueData) {
    const slotId = league.slotId || 1;
    return this.saveSlot(slotId, leagueData);
  },

  async loadGame() {
    const slotId = league.slotId || 1;
    return this.loadSlot(slotId);
  },

  async hasSave() {
    try {
      const index = await this.getSlotIndex();
      return Object.values(index.slots).some(s => s !== null);
    } catch {
      return false;
    }
  },

  async deleteSave() {
    const slotId = league.slotId || 1;
    return this.deleteSlot(slotId);
  },
};
