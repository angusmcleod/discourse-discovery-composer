import Composer from 'discourse/models/composer';
import ComposerController from 'discourse/controllers/composer';
import ComposerBody from 'discourse/components/composer-body';
import ComposerEditor from 'discourse/components/composer-editor';
import ComposerTitle from 'discourse/components/composer-title';
import ComposerMessages from 'discourse/components/composer-messages';
import TopicStatusView from 'discourse/raw-views/topic-status';
import topicIconClass from '../lib/topic-icon';
import DiscoveryRoute from 'discourse/routes/application';
import TopicRoute from 'discourse/routes/topic';
import TopicAdapter from 'discourse/adapters/topic';
import { ajax } from 'discourse/lib/ajax';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { getOwner } from 'discourse-common/lib/get-owner';

const discoveryComposeStates = {
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
    let height = $('.similar-titles').height() + 120;
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

export default {
  name: 'discovery-composer',
  initialize(){

    Composer.serializeOnCreate('topic_type', 'currentType')
    Composer.serializeOnCreate('make_wiki', 'makeWiki')
    Composer.reopen({
      showCategoryChooser: false,
      similarTitleTopics: Ember.A(),
      currentType: 'question',
      makeWiki: false,

      @computed('composeState')
      isDiscovery: function() {
        const state = this.get('composeState');
        return state && state.indexOf('discovery') > -1;
      },

      @computed('composeState')
      viewOpen: function() {
        return this.get('composeState') === 'open' ||
               this.get('isDiscovery')
      },

      @computed('hideRating')
      topicTypes: function() {
        const setting = Discourse.SiteSettings.topic_types;
        let types = setting ? setting.split('|') : [];
        types.push('default');
        return types;
      },

      @computed('composeState')
      hideRating() {
        return this.get('isDiscovery') && this.get('composeState') !== 'discoveryFull';
      }
    })

    ComposerController.reopen({

      // TO DO: combine the 'isDiscovery' properties on the model, controller and route into one
      @computed('application.currentPath')
      isDiscovery() {
        const path = this.get('application.currentPath')
        return path && path.indexOf('discovery') > -1;
      },

      @observes('model.composeState', 'isDiscovery')
      convertOpenToInitial() {
        if (this.get('model.composeState') === 'open' && this.get('isDiscovery')) {
          this.set('model.composeState', 'discoveryInitial')
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
          if (self.get('model.hasMetaData') || self.get('model.replyDirty')) {
            bootbox.confirm(I18n.t("post.abandon.confirm"), I18n.t("post.abandon.no_value"),
                I18n.t("post.abandon.yes_value"), function(result) {
              if (result) {
                self.destroyDraft();
                self.get('model').clearState();
                if (!self.get('isDiscovery')) {
                  self.close();
                }
                resolve();
              }
            });
          } else {
            // it is possible there is some sort of crazy draft with no body ... just give up on it
            self.destroyDraft();
            self.get('model').clearState();
            self.close();
            resolve();
          }
        });
      },

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
      titleValid: false,

      @on('init')
      setupBoundMethods() {
        this._super();
        this._handleClick = Ember.run.bind(this, this.handleClick);
        this._resizeComposer = Ember.run.bind(this, this.handleComposerResize);
      },

      @on('init')
      @observes('composer.isDiscovery,composer.similarTitleTopics.[]')
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
        const isDiscovery = composer.get('isDiscovery');

        if (isDiscovery) {
          return `topic.type.${composer.get('currentType')}.body`
        }
        return "composer.reply_placeholder"
      }
    })

    TopicStatusView.reopen({
      renderDiv: true,

      @observes('statuses')
      @on('init')
      _setup(){
        let type = this.get('topic.type')
        let topicIcon = {
          icon: topicIconClass(type),
          title: I18n.t("topic." + type + ".title"),
          openTag: 'span',
          closeTag: 'span'
        }
        this.get('statuses').pushObject(topicIcon)
      }
    })

    DiscoveryRoute.reopen({
      firstRenderDiscovery: false,
      transitionToDiscovery: false,

      disconnectComposer: function() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      },

      isDiscoveryPath: function() {
        const pathSlug = window.location.pathname.split('/')[1];
        const filters = Discourse.Site.currentProp('filters');
        let filterPath = pathSlug === '' || filters.filter(function(filter) {
                           return pathSlug === filter;
                         }).length > 0;
        let categoryPath = pathSlug === 'c';
        let categoriesPath = pathSlug === 'categories';
        return filterPath || categoryPath || categoriesPath
      },

      renderTemplate(controller, model) {
        this._super();
        if (this.currentUser && this.isDiscoveryPath()) {
          this.disconnectComposer();
          this.set('firstRenderDiscovery', true)
        }
      },

      actions: {

        didTransition: function() {
          this._super();
          if (this.currentUser && (this.get('firstRenderDiscovery') || this.get('transitionToDiscovery'))) {
            const controller = this.controllerFor("discovery/topics")
            this.controllerFor('composer').open({
              categoryId: controller.get('category.id'),
              action: Composer.CREATE_TOPIC,
              draftKey: controller.get('model.draft_key'),
              draftSequence: controller.get('model.draft_sequence'),
              composerState: 'discoveryInitial'
            });
            this.setProperties({
              'firstRenderDiscovery': false,
              'transitionToDiscovery': false
            })
          }
          return true; // Bubble the didTransition event
        },

        willTransition: function(transition) {
          if (this.currentUser) {
            if (transition.targetName.indexOf('discovery') > -1) {
              this.disconnectComposer();
              this.set('transitionToDiscovery', true)
            } else {
              const composer = getOwner(this).lookup('model:composer');
              composer.set('isDiscovery', false);
              this.controllerFor('composer').shrink();
              this.set('transitionToDiscovery', false)
            }
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        if (this.currentUser) {
          this.render('composer', {into: 'application', outlet: 'composer'})
        }
      },

      @on('deactivate')
      removeComposer() {
        if (this.currentUser) {
          this.disconnectOutlet({
            outlet: 'composer',
            parentView: 'application'
          });
        }
      }
    })
  }
};
