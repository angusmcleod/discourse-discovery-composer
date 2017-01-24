import Composer from 'discourse/models/composer';
import ComposerController from 'discourse/controllers/composer';
import ComposerBody from 'discourse/components/composer-body';
import TopicStatusView from 'discourse/raw-views/topic-status';
import topicIconClass from '../lib/topic-icon';
import DiscoveryRoute from 'discourse/routes/application';
import TopicRoute from 'discourse/routes/topic';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'discovery-compose',
  initialize(){

    Composer.reopen({
      showCategoryChooser: false
    })

    ComposerBody.reopen({
      @on('didInsertElement')
      showHideComposeBody() {
        if (window.location.pathname.indexOf('/t/') === -1) {
          this.contract()
          $(document).on('click', Ember.run.bind(this, this.handleClick))
        }
      },

      handleClick: function(event) {
        let $element = this.$();
        let $target = $(event.target);

        if ($target.closest($element).length) {
          this.expand();
        } else {
          this.contract();
        }
      },

      expand: function() {
        if (this.$()) {
          this.$().css('height', '400px')
          let self = this
          Ember.run.later((function() {
            self.$('.submit-panel').show()
          }), 300);
        }
      },

      contract: function() {
        if (this.$()) {
          this.$().css('height', '115px')
          this.$('.submit-panel').hide()
        }
      },

      @on('willDestroy')
      destroyExpandEvent() {
        $(document).off('click', Ember.run.bind(this, this.handleClick))
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
        this.disconnectOutlet({
          outlet: 'composer',
          parentView: 'application'
        });
      },

      renderTemplate(controller, model) {
        this._super();
        const pathArr = window.location.pathname.split('/')
        console.log(pathArr[0])
        if (pathArr[0] !== 't') {
          this.disconnectComposer();
          console.log("setting firstRenderDiscovery")
          this.set('firstRenderDiscovery', true)
        }
      },

      actions: {

        didTransition: function() {
          console.log(this.get('firstRenderDiscovery'), this.get('transitionToDiscovery'))
          if (this.get('firstRenderDiscovery') || this.get('transitionToDiscovery')) {
            this.openComposer(this.controllerFor("discovery/topics"));
          }
          this.set('firstRenderDiscovery', false)
          return true; // Bubble the didTransition event
        },

        willTransition: function(transition) {
          if (transition.targetName.indexOf('topic') > -1) {
            this.controllerFor('composer').shrink();
            this.set('transitionToDiscovery', false)
          } else {
            this.disconnectComposer();
            this.set('transitionToDiscovery', true)
          }
        }
      }
    })

    TopicRoute.reopen({
      @on('activate')
      addComposer() {
        this.render('composer', {into: 'application', outlet: 'composer'})
      },

      @on('deactivate')
      removeComposer() {
        this.disconnectOutlet({
          outlet: 'composer',
          parentView: 'application'
        });
      }
    })
  }
};
