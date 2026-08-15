import { TEAMS } from '../data/teams';
import { ROSTERS } from '../data/rosters';
import { SALARY_CAP, MAX_SALARY, MIN_SALARY } from './constants';

export const ContractEngine = {
  initializeSalaries() {
    TEAMS.forEach(team => {
      this.teamCaps[team.id] = { spent: 0, cap: SALARY_CAP };
    });

    Object.keys(ROSTERS).forEach(teamId => {
      let spent = 0;
      ROSTERS[teamId].forEach(player => {
        const salary = this.calculateSalary(player.overall, player.position);
        this.salaries[player.id] = { amount: salary, years: 3 };
        spent += salary;
      });
      if (this.teamCaps[teamId]) {
        this.teamCaps[teamId].spent = spent;
      }
    });
  },

  calculateSalary(overall, position) {
    let base = Math.floor((overall - 60) * 0.5);

    if (position === 'QB') base = Math.floor(base * 1.8);
    else if (['WR', 'CB', 'DL'].includes(position)) base = Math.floor(base * 1.2);

    return Math.max(MIN_SALARY, Math.min(MAX_SALARY, base));
  },

  getTeamCap(teamId) {
    return this.teamCaps[teamId] || { spent: 0, cap: SALARY_CAP };
  },

  getPlayerSalary(playerId) {
    return this.salaries[playerId] || { amount: 1, years: 1 };
  },

  getCapSpace(teamId) {
    const cap = this.getTeamCap(teamId);
    return cap.cap - cap.spent;
  },

  getExpiringContracts(teamId) {
    const roster = this.rosters[teamId] || [];
    return roster.filter(player => {
      const contract = this.getPlayerSalary(player.id);
      return contract.years <= 1;
    }).map(player => ({
      ...player,
      contract: this.getPlayerSalary(player.id),
    }));
  },

  extendContract(teamId, playerId, years, salary) {
    this.salaries[playerId] = { amount: salary, years };
    this.updateTeamSpending(teamId);
  },

  calculateExtensionCost(player) {
    const baseSalary = this.calculateSalary(player.overall, player.position);
    const ageFactor = player.age <= 27 ? 1.2 : player.age <= 30 ? 1.1 : 1.0;
    return Math.max(1, Math.floor(baseSalary * ageFactor));
  },

  decrementContractYears() {
    Object.keys(this.salaries).forEach(playerId => {
      const contract = this.salaries[playerId];
      if (contract && contract.years > 0) {
        contract.years -= 1;
      }
    });
  },

  getExpiredContractPlayers(teamId) {
    const roster = this.rosters[teamId] || [];
    return roster.filter(player => {
      const contract = this.salaries[player.id];
      return contract && contract.years <= 0;
    });
  },

  updateTeamSpending(teamId) {
    const roster = this.rosters[teamId] || [];
    let spent = 0;
    roster.forEach(player => {
      spent += this.getPlayerSalary(player.id).amount;
    });
    if (this.teamCaps[teamId]) {
      this.teamCaps[teamId].spent = spent;
    }
  },
};
