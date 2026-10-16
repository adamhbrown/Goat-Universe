/* Original GOATVILLE discovery and rules challenges. Recreational state only. */
(function (root) {
  'use strict';
  const districts = [
    { id: 'town-square', number: '01', name: 'Town Square', kicker: 'THE HEART OF THE UNIVERSE', host: 'Mayor Billy GOAT', status: 'PLAYABLE · SPORTS IQ', icon: 'square', x: 49, y: 65, title: 'Every great night starts somewhere.', copy: 'The championship lights are on. The Baa Report has a question for you. Billy insists the town was built on competition, creativity and community. He also insists he could have gone pro.', clue: 'The Baa Report is GOATVILLE’s commentary and storytelling voice.', question: 'Which voice brings the town’s commentary and stories?', options: ['The Weather Horn', 'The Baa Report', 'The Lost & Found'], answer: 1, reply: 'The Baa Report. Big opinions have found their address.', quote: '“The mayor’s office is open. So is the argument.”' },
    { id: 'championship-district', number: '02', name: 'Championship District', kicker: 'FIVE COMPETITIONS · FIVE WAYS IN', host: 'The GOAT Games', status: 'PLAYABLE · FIVE SPORTS ROOMS', icon: 'crown', x: 54, y: 42, title: 'Follow the championship lights.', copy: 'A football war room. A bracket lounge. Court meets ice. A franchise clubhouse. October under the lights. Five distinct practice rooms; bring your own conviction.', clue: 'GOAT Crossover combines basketball and hockey into one prediction card.', question: 'Which two sports share the GOAT Crossover arena?', options: ['Football and baseball', 'Golf and basketball', 'Basketball and hockey'], answer: 2, reply: 'Court and ice. Two arenas, one competitive instinct.', quote: '“Five ways to make a call. No place to hide from your own picks.”' },
    { id: 'tee-district', number: '03', name: 'GOAT TEE', kicker: 'THE SHORT GAME · LONG STORIES', host: 'Captain GOAT’s scenic detour', status: 'PLAYABLE · THREE-HOLE GOLF', icon: 'flag', x: 23, y: 66, title: 'A little green. A lot of ego.', copy: 'Set your aim. Find your touch. Take on three original putting greens with rails, sand and a summit finish. A clean round is its own good story.', clue: 'GOAT TEE is a three-hole putting game. Aim and power are yours to control.', question: 'How many greens make a GOAT TEE round?', options: ['Three', 'Nine', 'Eighteen'], answer: 0, reply: 'Three greens. Your short game now has a very public opinion of itself.', quote: '“That putt was at least a nautical mile.”' },
    { id: 'club-goat', number: '04', name: 'CLUB GOAT', kicker: 'THE LISTENING ROOM · SOUND BY CHOICE', host: 'DJ BAAA', status: 'LISTEN NOW · OFFICIAL THEME', icon: 'disc', x: 37, y: 31, title: 'Your soundtrack has arrived.', copy: 'Press play on GOATUNIVERSE, the founder-supplied official theme. Sound belongs to you. DJ BAAA’s working theory: the right anthem makes the walk-in better.', clue: 'DJ BAAA is CLUB GOAT’s resident mixmaster.', question: 'Who has the decks at CLUB GOAT?', options: ['Powder GOAT', 'DJ BAAA', 'Mayor Billy GOAT'], answer: 1, reply: 'DJ BAAA. Drop the beat. Keep the horns.', quote: '“Every song is the GOAT. This one is official.”' },
    { id: 'goat-island', number: '05', name: 'GOAT ISLAND', kicker: 'OFF THE CLOCK · WORLD PREVIEW', host: 'Captain GOAT', status: 'WORLD PREVIEW · DISCOVERY CLUE', icon: 'island', x: 76, y: 40, title: 'Leave the mainland behind.', copy: 'A future waterfront escape in the fictional world of GOATVILLE. Captain GOAT keeps the tall tales coming. The island attraction itself is still to be built; tonight you can meet its host and solve a discovery clue.', clue: 'Captain GOAT is the navigator and storyteller of GOAT ISLAND.', question: 'Whose stories get bigger every time you hear them?', options: ['Captain GOAT’s', 'The statistician’s', 'The parking attendant’s'], answer: 0, reply: 'Captain GOAT. Accurate navigation. Questionable distances.', quote: '“All aboard. No boring stories.”' },
    { id: 'mountain-lodge', number: '06', name: 'Mountain GOAT Ski Lodge', kicker: 'ABOVE THE NOISE · WORLD PREVIEW', host: 'Powder GOAT', status: 'WORLD PREVIEW · DISCOVERY CLUE', icon: 'mountain', x: 78, y: 20, title: 'The summit has its own crowd.', copy: 'A future alpine lodge with first-chair energy and last-word banter. This is an architectural world preview, with no skiing attraction yet. Powder GOAT has already claimed the chair by the fire.', clue: 'Powder GOAT is the first-chair, last-word personality of the Mountain GOAT Ski Lodge.', question: 'Who keeps the goggles on, even by the fireplace?', options: ['DJ BAAA', 'Captain GOAT', 'Powder GOAT'], answer: 2, reply: 'Powder GOAT. First chair. Last word.', quote: '“Send it. Then tell the story.”' },
  ];
  // Each rule names its context; no current results, player statistics or league data.
  const questions = [
    ['f1','Football','Six on the board.','In American football, how many points is a touchdown worth before the conversion attempt?', ['3','6','7','8'],1,'A touchdown is six points. The kick or two-point attempt comes afterward.'],
    ['f2','Football','The chains are waiting.','A team starts first-and-10. What distance normally earns a new set of downs?', ['5 yards','10 yards','15 yards','20 yards'],1,'Advancing ten yards normally earns a new first down. Goal-to-go and penalties can change the situation.'],
    ['f3','Football','Two points, your call.','After a touchdown, an American football team runs a successful two-point conversion. How many points did the touchdown and conversion add?', ['6','7','8','9'],2,'Six for the touchdown, two for the conversion: eight in total.'],
    ['f4','Football','Three the hard way.','In American football, how many points is a successful field goal worth?', ['1','2','3','6'],2,'A field goal is worth three points. An extra-point kick after a touchdown is worth one.'],
    ['b1','Basketball','One shot. One point.','In standard basketball, how many points is a made free throw worth?', ['1','2','3','4'],0,'Each made free throw counts as one point.'],
    ['b2','Basketball','Read the line.','A basketball player takes off from entirely behind the three-point arc and makes the shot. How many points?', ['1','2','3','4'],2,'A successful field goal from behind the arc is three points. Touching the arc makes it a two-point attempt.'],
    ['b3','Basketball','The margin matters.','A team trails 78–80. Its next play is a made three-pointer with no other scoring. What is the new score?', ['80–80','81–80','81–81','82–80'],1,'Add three to 78. The team leads 81–80.'],
    ['b4','Basketball','Keep the dribble alive.','A player ends a legal dribble, holds the ball, then starts dribbling again without any intervening touch. What is the usual violation?', ['Goaltending','Offside','Double dribble','Icing'],2,'Starting another dribble after ending the first is normally a double dribble.'],
    ['h1','Hockey','Between the pipes.','At normal full strength in ice hockey, how many players does one team have on the ice, including its goalie?', ['4','5','6','7'],2,'Five skaters and one goalie make six. Penalties and special formats can change that number.'],
    ['h2','Hockey','First to four.','In a best-of-seven ice hockey series, how many wins does a team need to take the series?', ['3','4','5','7'],1,'Four wins decide a best-of-seven series; a sweep ends it in four games.'],
    ['h3','Hockey','One night, three acts.','In standard regulation ice hockey, how many periods are played?', ['2','3','4','6'],1,'Regulation is three periods. Overtime rules depend on the competition.'],
    ['h4','Hockey','A sweep on ice.','One club wins a best-of-seven series without losing a game. How many games were played?', ['3','4','6','7'],1,'Four straight wins complete the sweep.'],
    ['a1','Baseball','Clear the bases.','A batter hits a home run with the bases loaded. How many runs score?', ['1','2','3','4'],3,'The three runners and the batter score: four runs, a grand slam.'],
    ['a2','Baseball','Three and out.','How many outs end one team’s half-inning in standard baseball?', ['2','3','4','6'],1,'Three outs retire the side and end the half-inning.'],
    ['a3','Baseball','The October math.','In a best-of-five baseball series, how many wins clinch the series?', ['2','3','4','5'],1,'Three wins clinch a best-of-five series. It can last three, four or five games.'],
    ['a4','Baseball','Around the diamond.','A runner starts on first. A home run is hit and everyone scores legally. How many bases does that original runner advance?', ['2','3','4','5'],1,'From first to second, third and home: three bases. The batter goes four.'],
    ['g1','Golf','One under.','In stroke-play golf, what is a score of one stroke under par on a hole called?', ['Bogey','Birdie','Eagle','Albatross'],1,'A birdie is one under par. An eagle is two under; a bogey is one over.'],
    ['g2','Golf','A clean scorecard.','A golfer takes 3 strokes on a par-5 hole. What is that score relative to par?', ['One under','Two under','Even par','Two over'],1,'Three strokes on par five is two under par, an eagle.'],
    ['g3','Golf','Who takes the card?','In ordinary stroke play, ignoring handicaps, which completed total wins?', ['The most strokes','The fewest strokes','The longest drive','The most birdies regardless of total'],1,'The player who completes the course in the fewest total strokes wins.'],
    ['g4','Golf','Add the round.','Three putting holes have pars 2, 3 and 3. You take 2, 2 and 3 putts. How did you finish?', ['One under par','Even par','One over par','Two under par'],0,'Par totals eight; your seven putts finish one under.'],
    ['x1','Fantasy','Know your scoring.','In this fictional fantasy format only, a passing touchdown earns 4 points. Two passing touchdowns earn how many?', ['4','6','8','12'],2,'Two times four is eight. Real fantasy leagues can use different scoring rules.'],
    ['x2','Fantasy','Every catch counts.','In this fictional full-PPR format, each reception earns 1 point. Five catches add how many reception points, before yardage?', ['2.5','5','10','50'],1,'Five catches at one point each add five reception points. Yardage is separate.'],
    ['x3','Fantasy','The lineup is yours.','In this demonstration, a bench player scores 20 and your starter scores 12. With no substitutions allowed after kickoff, how many points count from that starting slot?', ['8','12','20','32'],1,'Only the starter’s 12 points count in the stated format. Bench points do not replace them.'],
    ['x4','Fantasy','Projection or promise?','A fictional athlete is projected for 18 points. What does that projection represent?', ['A guaranteed score','An estimate, not a guarantee','An official result','An extra 18-point bonus'],1,'A projection is an estimate. Actual performance and your league’s scoring determine the result.'],
  ].map(([id,sport,title,prompt,options,answer,explanation]) => Object.freeze({id,sport,title,prompt,options:Object.freeze(options),answer,explanation}));
  function shuffle(items, random) {
    const copy = [...items];
    for (let i=copy.length-1;i>0;i-=1) {
      const value = random();
      const j = Math.floor((Number.isFinite(value) ? Math.max(0,Math.min(.999999999,value)) : 0) * (i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function createRound(random = Math.random) {
    const sports = [...new Set(questions.map(q=>q.sport))];
    const deck = shuffle(sports.map(sport=>shuffle(questions.filter(q=>q.sport===sport),random)[0]),random);
    return { deck, index:0, answers:[], complete:false };
  }
  function answer(state, option) {
    if (!state || state.complete || state.answers.length!==state.index || !Number.isInteger(option) || option < -1 || option >= state.deck[state.index].options.length) return false;
    state.answers.push(option);return true;
  }
  function advance(state) {
    if (!state || state.complete || state.answers.length!==state.index+1) return false;
    if (state.index===state.deck.length-1) state.complete=true;else state.index+=1;
    return true;
  }
  function score(state) { return state.answers.reduce((sum,value,i)=>sum+(value===state.deck[i].answer?1:0),0); }
  const api=Object.freeze({districts:Object.freeze(districts),questions:Object.freeze(questions),createRound,answer,advance,score});
  root.GoatResort=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
