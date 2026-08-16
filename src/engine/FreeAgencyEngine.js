import { FIRST_NAMES, LAST_NAMES, DRAFT_POSITIONS as FREE_AGENT_POSITIONS } from './constants';
import { blankPlayerStats, pickFrom } from './util';


export const FreeAgencyEngine = {
  generateFreeAgents() {
    const newFreeAgents = [];

    for (let i = 0; i < 15; i++) {
      const position = pickFrom(FREE_AGENT_POSITIONS, () => this._random());
      newFreeAgents.push({
        id: `fa_${Date.now()}_${i}`,
        name: `${pickFrom(FIRST_NAMES, () => this._random())} ${pickFrom(LAST_NAMES, () => this._random())}`,
        position,
        overall: 60 + Math.floor(this._random() * 25),
        age: 26 + Math.floor(this._random() * 8),
        stats: {},
      });
    }

    this.freeAgents = [...this.freeAgents, ...newFreeAgents].slice(0, 30);
    this.freeAgents.sort((a, b) => b.overall - a.overall);
  },

  getFreeAgents(positionFilter = null) {
    if (!positionFilter) return this.freeAgents;
    return this.freeAgents.filter(player => player.position === positionFilter);
  },

  signFreeAgent(teamId, playerId) {
    const playerIndex = this.freeAgents.findIndex(player => player.id === playerId);
    if (playerIndex === -1) return null;

    const player = this.freeAgents.splice(playerIndex, 1)[0];

    if (!this.rosters[teamId]) this.rosters[teamId] = [];
    this.rosters[teamId].push(player);
    this._indexAddPlayer(player, teamId);

    if (!this.playerStats[player.id]) {
      this.playerStats[player.id] = blankPlayerStats();
    }

    this.addToDepthChart(teamId, player);
    this.addNews(`${player.name} (${player.position}) signed with ${teamId}.`, 'transaction');
    return player;
  },

  cutPlayer(teamId, playerId) {
    const roster = this.rosters[teamId];
    if (!roster) return null;

    const playerIndex = roster.findIndex(player => player.id === playerId);
    if (playerIndex === -1) return null;

    const player = roster.splice(playerIndex, 1)[0];
    this._indexRemovePlayer(player.id);
    this.removeFromDepthChart(teamId, playerId);
    this.freeAgents.push(player);
    this.freeAgents.sort((a, b) => b.overall - a.overall);

    this.addNews(`${player.name} (${player.position}) was released by ${teamId}.`, 'transaction');
    return player;
  },
};
