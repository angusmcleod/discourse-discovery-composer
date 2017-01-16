var topicIcon = function(topicType) {
  switch(topicType){
    case 'discussion':
      return 'comments-o';
    case 'question':
      return 'question-circle';
    case 'wiki':
      return 'file-text-o';
    case 'rating':
      return 'star';
  }
}

export default topicIcon
