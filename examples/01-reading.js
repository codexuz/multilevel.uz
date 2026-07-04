var chiqish = document.getElementById('chiqish').innerHTML;
const InputCheckbox = {
  name: 'input-checkbox',
  model: {
      prop: 'model',
      event: 'change',
  },
  
  props: {
      model: {
          type: [String, Boolean, Object, Number, Array],
          required: true,
      },
      value: {
          type: [String, Boolean, Object, Number],
          required: true,
      },
      falseValue: {
          default: 0,
      },
      label: String,
      disabled: Boolean,
      checked: Boolean,
  },
  
 
  computed: {
      isModelArray() {
          return Array.isArray(this.model);
      },
      isValueObject() {
          return this.value !== null && typeof this.value === 'object';
      },
      isSelected() {
          const { model, value, isEqual, isValueObject, isModelArray } = this;
          
          if (isModelArray) {
              if (isValueObject) {
                  return model.some((obj) => isEqual(obj, value));
              } else {
                  return model.includes(value);
              }
          }

          if (isValueObject) {
              return isEqual(model, value);
          }

          return model === value;
      },
      stateClasses() {
          return {
              'checked': this.isSelected,
              'focused': this.focused,
              'disabled': this.disabled,
          }
      },
  },
  


  methods: {
      toggleCheck() {
          if (!this.disabled) {
              if (this.isModelArray) {
                  this.handleArrayCheckbox();
              } else {
                  this.handleSingleSelectCheckbox();
              }
          }
      },
      handleArrayCheckbox() {
          const newModel = this.model;

          if (!this.isSelected) {
              this.addValueToModel(newModel);
          } else {
              this.removeValueFromModel(newModel);
          }
      },
      handleSingleSelectCheckbox() {
          this.$emit('change', this.isSelected ? this.falseValue : this.value);
      },
      removeValueFromModel(newModel) {
          if (this.isValueObject) {
              newModel = newModel.filter((obj) => !this.isEqual(obj, this.value));
          } else {
              const index = newModel.indexOf(this.value);

              if (index !== -1) {
                  newModel.splice(index, 1);
              }
          }

          this.$emit('change', newModel);
      },
      addValueToModel(newModel) {
          newModel.push(this.value);

          this.$emit('change', newModel);
      },
      isEqual(a, b) {
          return JSON.stringify(a) === JSON.stringify(b);
      },
  },
  
  template: `
      <label :class="['input-checkbox', stateClasses]">
          <input
              type="checkbox"
              :value="value"
              :checked="isSelected"
              :disabled="disabled"
              @change="toggleCheck"
          />

          <span :class="['input-label']">
              {{ label }}
          </span>
      </label>
  `,
};


new Vue({
  el: '#mlreading',
  data () {
    return {
      user_id: null,
      userdoc: '',
      userfoto: '',
      showModal: false,
      intervalId: 0,
      minutes: '60',
      seconds: '00',
      test_numer: 1, r_j01: '', r_j02: '', r_j03: '', r_j04: '', r_j05: '', r_j06: '', r_j07: '', r_j08: '', r_j09: '', r_j10: '', r_j11: '', r_j12: '', r_j13: '', r_j14: '', r_j15: '', r_j16: '', r_j17: '', r_j18: '', r_j19: '', r_j20: '', r_j21: '', r_j22: '', r_j23: '', r_j24: '', r_j25: '', r_j26: '', r_j27: '', r_j28: '', r_j29: '', r_j30: '', r_j31: '', r_j32: '', r_j33: '', r_j34: '', r_j35: ''
    };
  },
  components: {
      InputCheckbox,
  },

  created() {
    this.user_id = chiqish;
    this.getUserDoc();
  },
  mounted () {
    this.startTimer(60 * 60)
  },
  methods: {
    startTimer (duration, display) {
        var timer = duration,
          minutes,
          seconds
        this.intervalId = setInterval(() => {
          this.minutes = parseInt(timer / 60, 10)
          this.seconds = parseInt(timer % 60, 10)
  
          this.minutes = this.minutes < 10 ? "0" + this.minutes : this.minutes
          this.seconds = this.seconds < 10 ? "0" + this.seconds : this.seconds
  
          if (--timer < 0) {
            clearInterval(this.intervalId)
            this.putMlReading();
          }
          else if (this.minutes ==0 && this.seconds == 59) {
            this.showModal= true;
          }
          else{
          }
        }, 1000)
    },
    getUserDoc(user_id) {
        user_id = this.user_id,
        axios.get(`https://mytests.uz/api/user/${user_id}`)
        .then(response => { 
          this.userdoc = response.data;
          if(response.data.foto == null){
          this.userfoto = '/fotouser/fotouser.jpg';
        }
        else{
          this.userfoto = '/fotouser/'+response.data.foto ;
        }
        })
        .catch(error => {
          return 'Error: ' + error.response.status
        });
      },

    putMlReading() {
      axios.put('https://mytests.uz/api/mlreading', {r_j01: this.r_j01, r_j02: this.r_j02, r_j03: this.r_j03, r_j04: this.r_j04, r_j05: this.r_j05, r_j06: this.r_j06, r_j07: this.r_j07, r_j08: this.r_j08, r_j09: this.r_j09, r_j10: this.r_j10, r_j11: this.r_j11, r_j12: this.r_j12, r_j13: this.r_j13, r_j14: this.r_j14, r_j15: this.r_j15, r_j16: this.r_j16, r_j17: this.r_j17, r_j18: this.r_j18, r_j19: this.r_j19, r_j20: this.r_j20, r_j21: this.r_j21, r_j22: this.r_j22, r_j23: this.r_j23, r_j24: this.r_j24, r_j25: this.r_j25, r_j26: this.r_j26, r_j27: this.r_j27, r_j28: this.r_j28, r_j29: this.r_j29, r_j30: this.r_j30, r_j31: this.r_j31, r_j32: this.r_j32, r_j33: this.r_j33, r_j34: this.r_j31, r_j35: this.r_j35,
      user_id: this.user_id,
      test_numer: this.test_numer
      }).then(response => {
        window.location.href = 'multilevel';
      }).catch(error => {
        return 'Error: ' + error.response.status
      });
    },

  },


});
