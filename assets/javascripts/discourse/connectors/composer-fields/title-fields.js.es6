export default {
  setupComponent(args, component) {
    this.set('model', args.model);
    Ember.addObserver(args.model, 'title', this, function(model, property) {
      const title = model.get('title');
      let tipClass = (title && title.length > 0) ? 'active' : '';
      component.set('tipClass', tipClass);
    })

    Ember.addObserver(args.model, 'composeState', this, function(model, property) {
      const state = model.get('composeState');
      console.log(component)
      if (!component) { return }
      component.setProperties({
        showTip: state === 'discoveryInput',
        showTypes: state === 'discoveryTypes' || state === 'discoveryFull',
        typesState: state === 'discoveryTypes',
        showSimilarTitleTopics: state === 'discoverySimilar'
      })
      component.set('containerClass', state === 'discoveryTypes' ? 'types' : 'full');
    })

    const similarTitleTopics = args.model.get('similarTitleTopics');
    similarTitleTopics.addArrayObserver(this, {
      willChange: function(topics, offset, removeCount, addCount) {
        // necessary placeholder
      },
      didChange: function(topics, offset, removeCount, addCount) {
        if (component) {
          component.set('topics', topics);
        }
      }
    })

    component.set('topicTypes', args.model.get('topicTypes'));
    component.set('currentType', args.model.get('currentType'));
    Ember.addObserver(args.model, 'topicType', this, function(model, property) {
      this.set('currentType', model.get('currentType'));
    })
  },

  actions: {
    switchTopicType(topicType) {
      this.set('currentType', topicType);
    },

    goTo(state) {
      const model = this.get('model');
      model.set('composeState', `discovery${state}`);
    }
  }
}
