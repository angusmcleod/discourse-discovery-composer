import Composer from 'discourse/models/composer';
import ComposerController from 'discourse/controllers/composer';
import ComposerBody from 'discourse/components/composer-body';
import ComposerEditor from 'discourse/components/composer-editor';
import ComposerTitle from 'discourse/components/composer-title';
import ComposerMessages from 'discourse/components/composer-messages';
import { ajax } from 'discourse/lib/ajax';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { discoveryComposeStates } from '../lib/dc-utilities';

export default {
  name: 'dc-composer-edits',
  initialize(){
    Composer.serializeOnCreate('topic_type', 'currentType')
    Composer.serializeOnCreate('make_wiki', 'makeWiki')
    Composer.reopen({
      showCategoryChooser: false,
      similarTitleTopics: Ember.A(),
      ratingPluginDisplay: false,
      currentType: 'question',
      makeWiki: false,
      isDiscovery: false,

      @computed()
      topicTypes: function() {
        const setting = Discourse.SiteSettings.topic_types;
        let types = setting ? setting.split('|') : [];
        types.push('default');
        return types;
      }
    })

    ComposerController.reopen({
      _setModel(composerModel, opts) {
        this._super(composerModel, opts);
        if (opts.isDiscovery) {
          this.setProperties({
            'model.isDiscovery': true,
            'model.viewOpen': true,
            'model.composeState': 'discoveryInitial'
          })
        }
      },

      actions: {
        switchTopicType(topicType) {
          this.set('model.topicType', topicType );
        }
      },

      cancelComposer() {
        const self = this;
        return new Ember.RSVP.Promise(function (resolve) {
          const model = self.get('model');
          if (model.get('hasMetaData') || model.get('replyDirty')) {
            bootbox.confirm(I18n.t("post.abandon.confirm"), I18n.t("post.abandon.no_value"),
                I18n.t("post.abandon.yes_value"), function(result) {
              if (result) {
                self.destroyDraft();
                model.clearState();
                if (!model.get('isDiscovery')) {
                  self.close();
                }
                resolve();
              }
            });
          } else {
            self.destroyDraft();
            model.clearState();
            self.close();
            resolve();
          }
        });
      }

    })

    ComposerTitle.reopen({
      @on('didInsertElement')
      setupProcessTitle() {
        $('#reply-title').on('keydown', Ember.run.bind(this, this.processTitle));
      },

      processTitle(event) {
        if (event.keyCode === 13) {
          if (this.get('validation')) {
            this.set('validation.lastShownAt', true);
          } else {
            this.appEvents.trigger('composer:find-similar-title');
          }
        }
      },

      @on('willDestroy')
      destroyProcessTitle() {
        $('#reply-title').off('keydown', Ember.run.bind(this, this.processTitle));
      }
    })

    ComposerMessages.reopen({
      _lastTitleSimilaritySearch: null,

      @on('didInsertElement')
      watchValidTitle() {
        this.appEvents.on('composer:find-similar-title', this, this._findSimilarTitleTopics);
      },

      @on('willDestroyElement')
      destroyValidTitle() {
        this.appEvents.off('composer:find-similar-title', this, this._findSimilarTitleTopics);
      },

      _findSimilar() {
        return;
      },

      _findSimilarTitleTopics() {
        const composer = this.get('composer');

        // We don't care about similar topics unless creating a topic
        if (!composer.get('creatingTopic')) { return; }

        const title = composer.get('title') || '';
        const categoryId = composer.get('categoryId') || '';

        // Ensure the fields are of the minimum length
        if (title.length < Discourse.SiteSettings.min_title_similar_length) { return; }

        // Don't search over and over
        if (title === this._lastTitleSimilaritySearch) { return; }
        this._lastTitleSimilaritySearch = title;

        const similarTitleTopics = composer.get('similarTitleTopics');

        ajax("/discovery/similar-title", { type: 'POST', data: { title, categoryId }}).then(result => {
          similarTitleTopics.clear();
          similarTitleTopics.pushObjects(result);

          if (similarTitleTopics.get('length') > 0) {
            composer.set('composeState', 'discoverySimilar');
          } else {
            composer.set('composeState', 'discoveryTypes');
          }
        });
      }
    })

    ComposerBody.reopen({
      @on('init')
      setupBoundMethods() {
        this._super();
        this._handleClick = Ember.run.bind(this, this.handleClick);
        this._resizeComposer = Ember.run.bind(this, this.handleComposerResize);
      },

      @on('init')
      @observes('composer.composeState,composer.similarTitleTopics.[]')
      handleComposeState() {
        if (this.get('composer.isDiscovery')) {
          Ember.run.scheduleOnce('afterRender', this, function() {
            discoveryComposeStates[this.get('composer.composeState')]()
          })
        }
      },

      @on('didInsertElement')
      @observes('composer.isDiscovery')
      showHideComposeBody() {
        if (this.get('composer.isDiscovery')) {
          let self = this;
          Ember.run.scheduleOnce('afterRender', function() {
            $("#reply-title").on('click', self._handleClick);
          })
          this.appEvents.on('composer:accept-title', this, this.handleAcceptTitle);
        }
      },

      @on('willDestroyElement')
      destroyExpandEvent() {
        $("#reply-title").off('click', this._handleClick);
      },

      handleClick(event) {
        if (event.target.id === 'reply-title' && this.get('composer.composeState') === 'discoveryInitial') {
          this.set('composer.composeState', 'discoveryInput');
        }
      },

      handleAcceptTitle(event) {
        this.set('composer.composeState', 'discoveryFull');;
      },

      @observes('composer.composeState')
      setupHandleComposerResize() {
        if (this.get('composer.composeState') === 'discoveryFull') {
          $(".d-editor-input").on('keyup', this._resizeComposer);
          $(".d-editor-input").on('change', this._resizeComposer);
        } else {
          $(".d-editor-input").off('keyup', this._resizeComposer);
          $(".d-editor-input").off('change', this._resizeComposer);
        }
      },

      handleComposerResize() {
        const $fields = $('.composer-fields');
        const $textarea = $('.d-editor-input');
        const $submit = $('.submit-panel');
        $('#reply-control').css('height', $fields.height() + $submit.height() + $textarea[0].scrollHeight);
      }
    })

    ComposerEditor.reopen({
      @computed('composer.currentType')
      placeholder() {
        const composer = this.get('composer');
        if (composer.get('isDiscovery')) {
          return `topic.type.${composer.get('currentType')}.body`
        }
        return "composer.reply_placeholder"
      }
    })

  }
};
