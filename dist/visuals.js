// Topic-level photographs never depend on a correct answer or a specific location.
export const topicImages={
 'Capitals':{file:'city',alt:'A busy street between tall city buildings',label:'City life'},
 'World geography':{file:'highlands',alt:'Clouds drifting over green highlands',label:'Across the world'},
 'Philippines':{file:'coast',alt:'Gentle waves meeting a sandy tropical shore',label:'Island spirit'},
 'Land & water':{file:'forest',alt:'Sunlight falling across a forest path',label:'The natural world'}
};
export function contextImage(category){return topicImages[category]||topicImages['World geography'];}
