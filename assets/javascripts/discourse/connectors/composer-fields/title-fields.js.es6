import { getOwner } from 'discourse-common/lib/get-owner';
import { locationLabel } from 'discourse/plugins/civil-navigation/discourse/lib/map-utilities';

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
        showAddLocation: state === 'discoveryFull' && !model.get('location'),
        showAddEvent: state === 'discoveryFull' && type === 'event',
        showRating: state === 'discoveryFull' && type === 'rating' && model.get('showRating'),
        showSimilarTitleTopics: state === 'discoverySimilar',
        containerClass: state === 'discoveryTypes' ? 'types' : 'full'
      })
    })

    Ember.addObserver(args.model, 'location', this, function(model, property) {
      const location = model.get('location')
      let label = location ? locationLabel(location) : null;
      component.set('composerLocationLabel', label);
    })

    Ember.addObserver(args.model, 'event', this, function(model, property) {
      const event = model.get('event');
      if (event) {
        let label = moment(event.start).format('MMMM Do, h:mm a') + ' to '
                    + moment(event.end).format('h:mm a');
        component.setProperties({
          eventLabel: label,
          showAddEvent: false
        });
      } else {
        component.setProperties({
          eventLabel: null,
          showAddEvent: true
        });
      }
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
        showAddEvent: state === 'discoveryFull' && type === 'event' && !model.get('event'),
        showRating: state === 'discoveryFull' && type === 'rating' && model.get('showRating')
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
    showAddEvent() {
      const controller = getOwner(this).lookup('controller:composer');
      controller.send('showAddEvent');
    },
    showAddLocation() {
      const controller = getOwner(this).lookup('controller:composer');
      controller.send('showAddLocation');
    },
    removeLocation() {
      this.set('model.location', null);
    },
    removeEvent() {
      this.set('model.event', null);
    }
  }
}
