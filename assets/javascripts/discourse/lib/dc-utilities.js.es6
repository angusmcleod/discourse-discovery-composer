var discoveryComposeStates = {
  discoveryInitial: () => {
    $('#reply-control').find('.reply-to, .topic-type-choice, .wmd-controls, .submit-panel').hide();
    $('#reply-control').css({
      'min-height': '48px',
      'height': '48px'
    });
  },
  discoveryInput: () => {
    $('#reply-control').find('.input-tip').show();
    $('#reply-control').css({
      'min-height': '75px',
      'height': '75px'
    });
  },
  discoveryTypes: () => {
    let height = $('.composer-fields').height() + 10;
    $('#reply-control').find('.topic-type-choice').show();
    $('#reply-control').css({
      'min-height': height,
      'height': height
    });
  },
  discoverySimilar: () => {
    let height = $('.similar-titles').height() + 115;
    $('#reply-control').find('.reply-to, .topic-type-choice, .wmd-controls, .submit-panel').hide();
    $('#reply-control').css({
      'min-height': height,
      'height': height
    });
  },
  discoveryFull: () => {
    $('#reply-control').css('min-height', '400px');
    $('#reply-control').find('.wmd-controls').show();
    Ember.run.later((function() {
      $('#reply-control').find('.submit-panel').show();
    }), 300);
  }
}

var topicIconClass = function(topicType) {
  switch(topicType){
    case 'default':
      return 'comments-o';
    case 'question':
      return 'question-circle';
    case 'rating':
      return 'star';
    case 'event':
      return 'calendar';
  }
}

export { discoveryComposeStates, topicIconClass }
