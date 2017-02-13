export default {
  setupComponent(args, component) {
    Ember.addObserver(args.model, 'title', this, function(model, property) {
      const title = model.get('title');
      let tipClass = (title && title.length > 0) ? 'active' : '';
      component.set('tipClass', tipClass);
    })

    Ember.addObserver(args.model, 'bodyState', this, function(model, property) {
      if (model.get('bodyState') !== 'input') {
        component.set('tipClass', 'hidden');
      }
    })

    const similarTitleTopics = args.model.get('similarTitleTopics');
    similarTitleTopics.addArrayObserver(this, {
      willChange: function(topics, offset, removeCount, addCount) {
        // necessary placeholder
      },
      didChange: function(topics, offset, removeCount, addCount) {
        component.set('topics', topics);
      }
    })
  }
}
