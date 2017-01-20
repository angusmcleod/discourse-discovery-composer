import afterTransition from 'discourse/lib/after-transition';
import topicIconClass from '../lib/topic-icon';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import autosize from 'discourse/lib/autosize';
import { throwAjaxError } from 'discourse/lib/ajax-error';
import DiscourseURL from 'discourse/lib/url';
import { ajax } from 'discourse/lib/ajax';

const _create_serializer = {
        raw: 'body',
        category: 'category.id',
        topic_id: 'topic.id',
        archetype: 'archetypeId',
        typing_duration_msecs: 'typingTime',
        composer_open_duration_msecs: 'composerTime'
      }

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':discovery-composer', 'composer.loading', 'composer.createdPost:created-post', 'showPreview::hide-preview'],
  existingDiscussion: null,
  isUploading: false,
  disableSubmit: Ember.computed.or("loadingStream", "isUploading"),
  loadingStream: false,
  offScreen: false,
  body: '',
  visible: false,
  showRating: Ember.computed.equal('type', 'rating'),

  @observes('visible')
  _setup() {
    Ember.run.scheduleOnce('afterRender', () => {
      autosize(this.$('.d-editor-input'));
      this.$('.btn.create').appendTo(this.$('.d-editor-textarea-wrapper')[0]);
      this.$('.d-editor-button-bar').appendTo(this.$('.d-editor-textarea-wrapper')[0]);
      $('#reply-title').focus();
    });
  },

  @on('willDestroyElement')
  _tearDown() {
    autosize.destroy(this.$('.d-editor-input'));
  },

  @observes('body')
  _updateAutosize() {
    const evt = document.createEvent('Event'),
          ele = this.$('.d-editor-input')[0];
    evt.initEvent('autosize:update', true, false);
    ele.dispatchEvent(evt);
  },

  save: function() {
    if (this.get('cantSubmitPost')) {
      return;
    }

    if (this.get('showRating') && this.get('includeRating') && !this.get('rating')) {
      return bootbox.alert(I18n.t("composer.select_rating"));
    }

    let staged = false;
    const imageSizes = {};
    this.$('.discovery-editor img').each((i, e) => {
      const $img = $(e);
      const src = $img.prop('src');
      if (src && src.length) {
        imageSizes[src] = { width: $img.width(), height: $img.height() };
      }
    });

    let topic = this.get('topic'),
        user = this.get('currentUser'),
        store = this.container.lookup('store:main'),
        type = this.get('type'),
        wiki = type === 'wiki';

    let createdPost = store.createRecord('post', {
      title: this.$('input').val(),
      wiki: wiki,
      tags: [type]
    });

    this.serialize(_create_serializer, createdPost);

    const self = this;
    return createdPost.save().then(function(result) {

      if (result.responseJson.action === "enqueued") {
        self.clearCompose()
        const appController = self.container.lookup('controller:application');
        appController.send('postWasEnqueued', result.responseJson);
        self.appEvents.trigger('post-stream:refresh');
        return result;
      }

      this.appEvents.trigger('post-stream:refresh');

      user.set('topic_count', user.get('topic_count') + 1);
      if (type === 'rating') {
        self.saveRating(result.payload.id);
      }
      const category = self.site.get('categories').find(function(x) {
        return x.get('id') === (parseInt(createdPost.get('category'),10) || 1);
      });
      if (category) category.incrementProperty('topic_count');
      Discourse.notifyPropertyChange('globalNotice');
      DiscourseURL.routeTo('/t/' + result.payload.topic_slug)
    }).catch(throwAjaxError());
  },

  serialize: function(serializer, dest) {
    dest = dest || {};
    Object.keys(serializer).forEach(f => {
      const val = this.get(serializer[f]);
      if (typeof val !== 'undefined') {
        Ember.set(dest, f, val);
      }
    });
    return dest;
  },

  clearCompose: function() {
    this.setProperties({
      title: '',
      body: '',
      type: '',
      visible: false
    })
  },

  saveRating: function(postId) {
    ajax("/rating/rate", {
      type: 'POST',
      data: {
        id: postId,
        rating: this.get('rating')
      }
    }).catch(function (error) {
      popupAjaxError(error);
    });
  },

  actions: {
    save() {
      this.save()
    },
    switchType(type) {
      if (!this.get('currentUser')) {
        const appRoute = this.container.lookup('route:application');
        return appRoute.send('showLogin');
      }
      this.setProperties({
        'type': type,
        'visible': true
      })
    },
    showUploadModal(toolbarEvent) {
      this.sendAction('showUploadSelector', toolbarEvent);
    },
    closeComposer() {
      this.set('type', null)
      this.set('visible', false)
    },
    togglePreview() {
      this.toggleProperty('showPreview');
      this.keyValueStore.set({ key: 'composer.showPreview', value: this.get('showPreview') });
    },
    extraButtons(toolbar) {
      toolbar.addButton({
        id: 'quote',
        group: 'fontStyles',
        icon: 'comment-o',
        sendAction: 'importQuote',
        title: 'composer.quote_post_title',
        unshift: true
      });

      toolbar.addButton({
        id: 'upload',
        group: 'insertions',
        icon: 'upload',
        title: 'upload',
        sendAction: 'showUploadModal'
      });

      if (this.get("showPopupMenu")) {
        toolbar.addButton({
          id: 'options',
          group: 'extras',
          icon: 'gear',
          title: 'composer.options',
          sendAction: 'toggleOptions'
        });
      }

      toolbar.addButton({
        id: 'preview btn',
        group: 'extras',
        label: 'preview',
        title: 'composer.show_preview',
        sendAction: 'togglePreview'
      });
    }
  },

  closeAutocomplete: function() {
    this.$('.d-editor-input').autocomplete({ cancel: true });
  },

  keyDown: function(e) {
    var enter = Boolean(e.which === 13),
        ctrlCmd = Boolean(e.ctrlKey || e.metaKey);
    if (enter && ctrlCmd) {
      this.save()
      return false;
    }
  },

  cancel: function() {
    const self = this;
    return new Ember.RSVP.Promise(function (resolve) {
      if (self.get('body')) {
        bootbox.confirm(I18n.t("post.abandon.confirm"), I18n.t("post.abandon.no_value"),
            I18n.t("post.abandon.yes_value"), function(result) {
          if (result) {
            self.close();
            resolve();
          }
        });
      } else {
        self.close();
        resolve();
      }
    });
  },

  @computed('composer.titleLength', 'composer.missingTitleCharacters', 'composer.minimumTitleLength', 'lastValidatedAt')
  validation(titleLength, missingTitleChars, minimumTitleLength, lastValidatedAt) {
    let reason;
    if (titleLength < 1) {
      reason = I18n.t('composer.error.title_missing');
    } else if (missingTitleChars > 0) {
      reason = I18n.t('composer.error.title_too_short', {min: minimumTitleLength});
    } else if (titleLength > this.siteSettings.max_topic_title_length) {
      reason = I18n.t('composer.error.title_too_long', {max: this.siteSettings.max_topic_title_length});
    }
    if (reason) {
      return InputValidation.create({ failed: true, reason, lastShownAt: lastValidatedAt });
    }
  },

  @computed('loading', 'targetUsernames', 'missingReplyCharacters')
  cantSubmitPost() {
    if (this.get('loading')) return true;
    if (this.get('replyLength') < 1) return true;
  },

  @computed('body')
  bodyLength() {
    let body = this.get('body') || "";
    return body.replace(/\s+/img, " ").trim().length;
  },

  @computed('type')
  typeTitle() {
    return 'topic.' + this.get('type') + '.title'
  },

  @computed('type')
  titlePlaceholder() {
    return 'topic.' + this.get('type') + '.title_placeholder'
  },

  @computed('type')
  connectorText() {
    const category = this.get('category');
    let text = I18n.t('search.advanced.in_category.label').toLowerCase();
    return category ? text.split(" ")[0] : ''
  },

  @computed()
  createText() {
    let text = I18n.t('composer.create_topic')
    return text.split(" ")[0]
  },

  @computed('type')
  tags() {
    return [this.get('type')]
  },

  @computed('type')
  topicIcon(){
    return topicIconClass(this.get('type'))
  }
})
