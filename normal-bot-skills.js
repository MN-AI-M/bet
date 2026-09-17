(() => {
  const usefulSkills = [
    { id: 2, name: '一手消去', desc: '相手の石1個消去' },
    { id: 4, name: '一列消去', desc: '相手が並ぶ1列消去' },
    { id: 7, name: '浸食', desc: '指定マスを自分の色に' },
    { id: 8, name: '確約', desc: '指定マスに相手配置不可' },
    { id: 12, name: '罠', desc: '見えない罠を設置' }
  ];

  function keepBotSkillAvailable() {
    if (typeof state === 'undefined' || state.mode !== 'pve' || state.currentPlayer !== 2 || state.isGameOver || !state.hands?.[2]) return;
    const hasUsefulSkill = state.hands[2].some((skill) => usefulSkills.some((candidate) => candidate.id === skill.id));
    if (hasUsefulSkill) return;
    const skill = usefulSkills[Math.floor(Math.random() * usefulSkills.length)];
    if (state.hands[2].length >= 3) state.hands[2][state.hands[2].length - 1] = { ...skill };
    else state.hands[2].push({ ...skill });
  }

  setInterval(keepBotSkillAvailable, 100);
})();
