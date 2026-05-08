const TRAINING_OPTIONS = [
  {
    id: 'balanced',
    name: 'Balanced Reps',
    summary: 'Small boost across the roster.',
    offenseBonus: 0.75,
    defenseBonus: 0.75,
    injuryModifier: 0,
    developmentBonus: 0.25,
  },
  {
    id: 'qb_timing',
    name: 'QB Timing',
    summary: 'Passing-game polish for the next matchup.',
    offenseBonus: 1.75,
    defenseBonus: 0,
    injuryModifier: 0,
    developmentBonus: 0.25,
  },
  {
    id: 'ground_game',
    name: 'Ground Game',
    summary: 'Run fits, blocking angles, and ball security.',
    offenseBonus: 1.25,
    defenseBonus: 0.25,
    injuryModifier: -0.05,
    developmentBonus: 0,
  },
  {
    id: 'pass_rush',
    name: 'Pass Rush',
    summary: 'Pressure packages and third-down disruption.',
    offenseBonus: 0,
    defenseBonus: 1.5,
    injuryModifier: 0.05,
    developmentBonus: 0.15,
  },
  {
    id: 'coverage',
    name: 'Coverage Shells',
    summary: 'Limit explosive throws and clean up assignments.',
    offenseBonus: 0,
    defenseBonus: 1.25,
    injuryModifier: -0.05,
    developmentBonus: 0.15,
  },
  {
    id: 'conditioning',
    name: 'Conditioning',
    summary: 'Recovery week that reduces injury risk.',
    offenseBonus: 0.35,
    defenseBonus: 0.35,
    injuryModifier: -0.18,
    developmentBonus: 0,
  },
  {
    id: 'rookie_development',
    name: 'Rookie Development',
    summary: 'Less immediate juice, better long-term growth.',
    offenseBonus: 0.25,
    defenseBonus: 0.25,
    injuryModifier: 0,
    developmentBonus: 1.25,
  },
];

const byId = TRAINING_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option;
  return acc;
}, {});

export const TrainingEngine = {
  initializeTraining() {
    this.trainingFocus = {};
  },

  getTrainingOptions() {
    return TRAINING_OPTIONS;
  },

  getWeeklyTraining(teamId) {
    const saved = this.trainingFocus?.[teamId];
    const option = byId[saved?.focusId] || byId.balanced;
    return {
      ...option,
      focusId: option.id,
      weekSet: saved?.weekSet || null,
    };
  },

  setWeeklyTraining(teamId, focusId) {
    const option = byId[focusId] || byId.balanced;
    if (!this.trainingFocus) this.initializeTraining();
    this.trainingFocus[teamId] = {
      focusId: option.id,
      weekSet: this.currentWeek,
      season: this.season || 1,
    };
    this.addNews(`${teamId} set weekly training focus to ${option.name}.`, 'transaction');
    return this.getWeeklyTraining(teamId);
  },

  getTrainingScoreModifier(offenseTeamId, defenseTeamId) {
    const offenseFocus = this.getWeeklyTraining(offenseTeamId);
    const defenseFocus = this.getWeeklyTraining(defenseTeamId);
    return (offenseFocus.offenseBonus || 0) - (defenseFocus.defenseBonus || 0);
  },

  getTrainingRatingModifier(teamId, side) {
    const focus = this.getWeeklyTraining(teamId);
    if (side === 'offense') return focus.offenseBonus || 0;
    if (side === 'defense') return focus.defenseBonus || 0;
    return ((focus.offenseBonus || 0) + (focus.defenseBonus || 0)) / 2;
  },

  getTrainingDevelopmentBonus(teamId) {
    return this.getWeeklyTraining(teamId).developmentBonus || 0;
  },

  getTrainingInjuryModifier(teamId) {
    return this.getWeeklyTraining(teamId).injuryModifier || 0;
  },

  getTeamWithTrainingModifiers(teamId) {
    const team = this.findTeamById ? this.findTeamById(teamId) : null;
    if (!team) return null;
    const offense = Math.round((team.ratings.offense || 0) + this.getTrainingRatingModifier(teamId, 'offense'));
    const defense = Math.round((team.ratings.defense || 0) + this.getTrainingRatingModifier(teamId, 'defense'));
    return {
      ...team,
      ratings: {
        ...team.ratings,
        offense,
        defense,
        overall: Math.round((offense + defense) / 2),
      },
    };
  },
};
