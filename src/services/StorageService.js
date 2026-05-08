import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEAMS } from '../data/teams';
import { league } from '../engine/LeagueEngine';

const INDEX_KEY = '@nfl_manager_index';
const LEGACY_KEY = '@nfl_manager_save';
const SAVE_SCHEMA_VERSION = 2;
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
    schemaVersion: leagueData.schemaVersion || SAVE_SCHEMA_VERSION,
  };
}

function withSchema(leagueData) {
  return { schemaVersion: SAVE_SCHEMA_VERSION, ...leagueData };
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
        try {
          const data = JSON.parse(legacyRaw);
          // Write slot data first; only update index meta if this succeeds
          await AsyncStorage.setItem(slotKey(1), legacyRaw);
          index.slots[1] = buildSlotMeta(1, data);
        } catch (parseOrWriteError) {
          console.error('Error migrating legacy save:', parseOrWriteError);
          // index.slots[1] stays null — migration skipped, legacy key preserved
        }
      }
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('Error during save migration:', error);
    }
    return index;
  },

  async saveSlot(slotId, leagueData) {
    try {
      const payload = withSchema(leagueData);
      await AsyncStorage.setItem(slotKey(slotId), JSON.stringify(payload));
      // Read raw index directly to avoid triggering migration inside a save
      let index;
      try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        index = raw !== null ? JSON.parse(raw) : emptyIndex();
      } catch {
        index = emptyIndex();
      }
      index.slots[slotId] = buildSlotMeta(slotId, payload);
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
      if (raw !== null) return { success: true, data: withSchema(JSON.parse(raw)) };
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

  async saveCurrentGame(leagueInstance = league) {
    if (!leagueInstance || typeof leagueInstance.getSaveData !== 'function') {
      return { success: false, error: 'Invalid league instance' };
    }
    return this.saveSlot(leagueInstance.slotId || 1, leagueInstance.getSaveData());
  },

  async deleteCurrentGame(leagueInstance = league) {
    return this.deleteSlot(leagueInstance?.slotId || 1);
  },
};
