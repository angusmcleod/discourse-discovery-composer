import computed from "ember-addons/ember-computed-decorators";

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':topic-type-btn'],

  @computed('active')
  topicTypeClass() {
    const topicType = this.get('topicType');
    let classes = topicType;
    if (this.get('active')) {
      classes += ' active';
    }
    return classes;
  },

  @computed('currentType')
  active() {
    return this.get('currentType') === this.get('topicType');
  },

  @computed()
  topicTypeLabel() {
    return `topic.type.${this.get('topicType')}.label`;
  },

  actions: {
    switchTopicType(){
      this.sendAction('switchTopicType', this.get('topicType'));
    }
  }
})
