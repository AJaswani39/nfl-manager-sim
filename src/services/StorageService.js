import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVE_KEY = '@nfl_manager_save';

export const StorageService = {
  async saveGame(leagueData) {
    try {
      const jsonValue = JSON.stringify(leagueData);
      await AsyncStorage.setItem(SAVE_KEY, jsonValue);
      return { success: true };
    } catch (error) {
      console.error('Error saving game:', error);
      return { success: false, error: error.message };
    }
  },

  async loadGame() {
    try {
      const jsonValue = await AsyncStorage.getItem(SAVE_KEY);
      if (jsonValue !== null) {
        return { success: true, data: JSON.parse(jsonValue) };
      }
      return { success: false, error: 'No save found' };
    } catch (error) {
      console.error('Error loading game:', error);
      return { success: false, error: error.message };
    }
  },

  async hasSave() {
    try {
      const jsonValue = await AsyncStorage.getItem(SAVE_KEY);
      return jsonValue !== null;
    } catch {
      return false;
    }
  },

  async deleteSave() {
    try {
      await AsyncStorage.removeItem(SAVE_KEY);
      return { success: true };
    } catch (error) {
      console.error('Error deleting save:', error);
      return { success: false, error: error.message };
    }
  }
};
