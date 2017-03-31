export default {
  setupComponent(args, component) {
    this.set('model', args.model);
    Ember.addObserver(args.model, 'title', this, function(model, property) {
      if (component._state == 'destroying') { return }

      const title = model.get('title');
      let tipClass = (title && title.length > 0) ? 'active' : '';
      component.set('tipClass', tipClass);
    })

    Ember.addObserver(args.model, 'composeState', this, function(model, property) {
      if (component._state == 'destroying') { return }

      const state = model.get('composeState');
      const type = model.get('currentType');
      component.setProperties({
        showTip: state === 'discoveryInput',
        showTypes: state === 'discoveryTypes' || state === 'discoveryFull',
        typesState: state === 'discoveryTypes',
        showSimilarTitleTopics: state === 'discoverySimilar',
        containerClass: state === 'discoveryTypes' ? 'types' : 'full'
      })
    })

    const similarTitleTopics = args.model.get('similarTitleTopics');
    similarTitleTopics.addArrayObserver(this, {
      willChange: function(topics, offset, removeCount, addCount) {
        // necessary placeholder
      },
      didChange: function(topics, offset, removeCount, addCount) {
        if (component._state == 'destroying') { return }
        component.set('topics', topics);
      }
    })

    component.set('topicTypes', args.model.get('topicTypes'));
    component.set('currentType', args.model.get('currentType'));
    Ember.addObserver(args.model, 'currentType', this, function(model, property) {
      if (component._state == 'destroying') { return }

      const state = model.get('composeState');
      const type = model.get('currentType');
      component.setProperties({
        currentType: type,
        showMakeWiki: state === 'discoveryFull' && type === 'default',
        isEvent: state === 'discoveryFull' && type === 'event'
      })
    })
  },

  actions: {
    switchTopicType(topicType) {
      this.set('model.currentType', topicType);
    },
    goTo(state) {
      this.set('model.composeState', `discovery${state}`);
    },
    showScheduleBuilder() {
      const controller = this.container.lookup('controller:composer');
      controller.send('showScheduleBuilder');
    }
  }
}
