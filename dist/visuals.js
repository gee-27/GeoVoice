// Topic-level photographs never depend on a correct answer or a specific location.
export const topicImages={
 'Capitals':{file:'city',alt:'A busy street between tall city buildings',label:'City life'},
 'World geography':{file:'highlands',alt:'Clouds drifting over green highlands',label:'Across the world'},
 'Philippines':{file:'coast',alt:'Gentle waves meeting a sandy tropical shore',label:'Island spirit'},
 'Land & water':{file:'forest',alt:'Sunlight falling across a forest path',label:'The natural world'}
};
export function contextImage(category){return topicImages[category]||topicImages['World geography'];}

// Explicit question contexts. Selection uses the stable question ID, never its answer.
const scene=(file,label,alt,fit='cover')=>({file,label,alt,fit});
const flag=(code,country)=>scene('flag-'+code+'.png',country+' · country in the question','Flag of '+country,'contain');
const globe=label=>scene('globe.svg',label,'An unlabeled globe with equally styled grid lines','contain');
const water=label=>scene('coast.jpg',label,'Waves and open water beside a sandy shore');
const mountains=label=>scene('mountains.jpg',label,'A range of mountain peaks without location labels');
export const questionImages={
 1:flag('jp','Japan'),2:flag('au','Australia'),3:flag('ca','Canada'),4:flag('br','Brazil'),5:flag('eg','Egypt'),
 6:flag('nz','New Zealand'),7:flag('th','Thailand'),8:flag('ke','Kenya'),9:flag('it','Italy'),10:flag('ar','Argentina'),
 11:globe('Continents & land area'),12:water('The world’s oceans'),13:globe('Earth’s hemispheres'),
 14:scene('dunes.jpg','Desert landscapes','Sand dunes without location markers'),15:globe('Countries & land area'),
 16:globe('People & continents'),17:mountains('Mountain ranges'),18:water('Seas & coastlines'),19:globe('Countries on a map'),20:globe('Longitude & navigation'),
 21:flag('ph','Philippines'),22:water('Philippine island geography'),23:scene('highlands.jpg','Hills & landscapes','Rounded green slopes beneath moving clouds'),
 24:scene('volcano.jpg','Volcanic landscapes','An erupting volcanic peak without province labels'),25:mountains('Mountain elevations'),26:water('Island geography'),
 27:scene('cave.jpg','Underground waterways','Water flowing inside a rocky cavern'),28:water('Beach destinations'),29:water('Surrounding ocean waters'),
 30:scene('forest.jpg','Cool highland environments','A shaded wooded path'),31:scene('dunes.jpg','Hot desert environments','Sunlit sand dunes without location markers'),
 32:mountains('Mountain ranges'),33:water('Where land meets water'),34:water('Land & water connections'),35:water('Island landscapes'),
 36:scene('river.jpg','River environments','A flowing river between wooded banks'),37:water('Oceans & continents'),38:water('Exploring ocean depths'),
 39:scene('lake.jpg','Freshwater lakes','Still lake water reflecting surrounding slopes'),40:scene('waterfall.jpg','Waterfall environments','Falling water over a rocky ledge without location labels')
};
export function questionImage(question){return questionImages[question.id]||globe('Geography');}
