import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import Modal from 'react-modal';
// import TweenMax from "gsap/TweenMax";
import _ from 'lodash';
import seedrandom from 'seedrandom';
import Proton from 'proton-js';
import Victor from 'victor';
import './App.css';

//global constants
Modal.setAppElement('#root')
const fps = 60;
const animInterval = 1000/fps;
const KEY = {
  LEFT:  37,
  RIGHT: 39,
  UP: 38,
  DOWN: 40,
  A: 65,
  D: 68,
  W: 87,
  S: 83,
  SPACE: 32
};

//various utility
function objectDistance(b1={x:0,y:0}, b2={x:0,y:0}) {
  let v1 = new Victor(b1.x,b1.y);
  let v2 = new Victor(b2.x,b2.y);
  return v1.distance(v2);
  // if (b1&&b2) {
  //   return Math.sqrt(Math.pow(b1.x-b2.x, 2) + Math.pow(b1.y-b2.y, 2));
  // }
}

function towardsBody(origin, target) {
  //makes a vector to follow
  if (origin&&target) {
    let tx = (origin.x - target.x) / objectDistance(origin, target);
    let ty = (origin.y - target.y) / objectDistance(origin, target);
    return { x: tx, y: ty };
  }
}

// function getBearing(originX, originY, targetX, targetY) {
//   return -Math.atan2(targetY-originY, targetX-originX) *360/(Math.PI*2);
// }

function shadeColor(color, rShade, gShade=rShade, bShade=rShade) {
  var R = parseInt(color.substring(1,3),16);
  var G = parseInt(color.substring(3,5),16);
  var B = parseInt(color.substring(5,7),16);
  R = parseInt(R * (100 + rShade) / 100);
  G = parseInt(G * (100 + gShade) / 100);
  B = parseInt(B * (100 + bShade) / 100);
  R = (R<255)?R:255;
  G = (G<255)?G:255;
  B = (B<255)?B:255;
  var RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
  var GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
  var BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));
  return "#"+RR+GG+BB;
}

class OrbitGame extends Component {
  constructor(props) {
    super(props);
    this.state = {
      screen: {
        width: this.props.width,
        height: this.props.height,
        // dynWidth: window.innerWidth/2,
        // dynHeight: window.innerHeight/2,
        ratio: window.devicePixelRatio || 1,
      },
      starList: [
        {name:"Lalande",num:5},{name:"Tau Ceti",num:4},{name:"Groombridge",num:2},{name:"Alpha Centauri",num:4},{name:"Epsilon Eriadni",num:7},{name:"Procyon A",num:0},{name:"Procyon B",num:1},{name:"Ross 154",num:3},{name:"Barnard's Star",num:8}
      ],
      world: {
        stage: "Sol",
        bodies: [],
        pendingBodies: [],
        //will externalize db stuff
        bDatabase: {
          Sol: [
            {data: solData, parent: 0, index: 0, active: true},
            {data: marsData, parent: 0, index: 1, active: true},
            {data: venusData, parent: 0, index: 2, active: true},
            {data: phobosData, parent: 1, index: 3, active: true},
            {data: earthData, parent: 0, index: 4, active: true},
            {data: saturnData, parent: 0, index: 5, active: false},
          ],
          // AlphaCentauri: [],
          // Wolf359: [],
          // EpsilonEridani: [],
        },
        structures: [],
        pendingStructures: [

        ],
        sDatabase: {
          Sol: [
            {data: rs1, openings: 1, index: 0, active: true},
            {data: rs2, openings: 4, index: 1, active: true},
            {data: rs3, openings: 0, index: 2, active: true},
            {data: rs4, openings: 8, index: 3, active: false},
          ]
        }
      },
      params: {
        gravFalloff: 0.9,
        bounceDampening: 0.9,
      },
      ball: {
        x: 190,
        y: 210,
        vx: 0.5,
        vy: 0.5,
        size: 6,
        mass: 3,
        speed: 0,
        thrustAcc: 0.1,
        heading: 0,
        power: 0,
        coll: false,
        ct: 0,
        color: "#E0EDFF",
        glow: 1,
      },
      resources: {
        matter: 0,
        energy: 1500,
        psi: 0,
        hm: 0,
      },
      keys: {
        left  : 0,
        right : 0,
        up    : 0,
        down  : 0,
        space : 0,
      },
      proton: {

      },
      mousedown: false,
      mouseTick: 0,
      mouseReleased: false,
      mouseObj: {
        x: 350,
        y: 350,
        init: false,
      },
      selectedObj: null,
      tick: 0,
      ts: 0,
      randomHash: 0,
      currentScore: 0,
      inGame: true,
      showModal: false,
    };
    this.sharedEB = [];
    this.animationID = null;
    this.timerID = null;
    this.handlePowerChange = this.handlePowerChange.bind(this);
    this.handleChargePsi = this.handleChargePsi.bind(this);
    this.handleSystemChange = this.handleSystemChange.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handlePlanetToggle = this.handlePlanetToggle.bind(this);
    this.handleStructureToggle = this.handleStructureToggle.bind(this);
    this.handlePauseStart=this.handlePauseStart.bind(this);
    this.handleKeys=this.handleKeys.bind(this);
    this.mouseupHandler = this.mouseupHandler.bind(this);
    this.mousedownHandler = this.mousedownHandler.bind(this);
    this.mousemoveHandler = this.mousemoveHandler.bind(this);
    this.handleOpenModal = this.handleOpenModal.bind(this);
    this.handleCloseModal = this.handleCloseModal.bind(this);
  }

  //user interface
  makeMapInterface(ui) {
    const starList = [...this.state.starList];
    starList.push({name:'Sol',num:6})
    return starList.map(
      (star) =>
      <StarButton onClick={this.handleSystemChange} star={star.name} ui={ui} />
    )
  }

  selectOnCanvas() {
    // let _x = this.state.mouseObj.x;
    // let _y = this.state.mouseObj.y;
    let mouse = {...this.state.mouseObj}
    const bodies = [...this.state.world.bodies];
    for (let body of bodies) {
      if (objectDistance(mouse, body) < body.size+6) {
        console.log(body.name)
        return this.setState((prevState) => {
          return {
            selectedObj: body,
          }
        });
      }
    }
  }

  //handlers
  handlePowerChange() {
    this.setState((prevState) => {
      return {
        currentScore: 0,
        resources: {
          ...prevState.resources,
          energy: prevState.resources.energy + prevState.currentScore*10,
        },
      }
    });
  }

  handleCanvasClick(e) {

  }

  handleChargePsi() {
    this.setState((prevState) => {
      return {
        resources: {
          ...prevState.resources,
          psi: prevState.resources.psi+1,
        },
      }
    });
    // this.emitterParticleCheck(this.state.proton.psiEmitter,this.state.world.bodies[0],8);
  }

  handleKeys(value, e) {
    let keys = {...this.state.keys};
    if(e.keyCode === KEY.LEFT   || e.keyCode === KEY.A) { keys.left  = value?keys.left+1:0 }
    if(e.keyCode === KEY.DOWN   || e.keyCode === KEY.S) { keys.down  = value?keys.down+1:0 }
    if(e.keyCode === KEY.RIGHT  || e.keyCode === KEY.D) { keys.right = value?keys.right+1:0 }
    if(e.keyCode === KEY.UP     || e.keyCode === KEY.W) { keys.up    = value?keys.up+1:0 }
    if(e.keyCode === KEY.SPACE) keys.space = value?keys.space+0:0;
    this.setState((prevState) => {
      return { keys: keys }
    });
  }

  mousedownHandler(e) {
    // this.setState((prevState) => {
    //   return {
    //     mousedown: true,
    //   }
    // });
    // this.mousemoveHandler(e);
    let _x = e.nativeEvent.layerX;
    let _y = e.nativeEvent.layerY;
    // console.log(_x, _y)
   this.setState((prevState) => {
      return {
        mousedown: true,
        mouseObj: {
          x: _x,
          y: _y,
        },
      }
    });
    this.selectOnCanvas();
  }

  mouseupHandler(e) {
    this.setState((prevState) => {
      return { mousedown: false }
    });
  }

  mousemoveHandler(e) {
    if (this.state.mousedown) {
      let _x = e.nativeEvent.layerX;
      let _y = e.nativeEvent.layerY;
      return this.setState((prevState) => {
        return {
          mouseObj: {
            x: _x,
            y: _y,
          },
        }
      });
    }
  }

  handleOpenModal () {
    this.setState({ showModal: true });
  }
  handleCloseModal () {
    this.setState({ showModal: false });
  }
  handleSystemChange(e) {
    let target = e.target.id;
    return this.systemChange(target);
  }
  handlePlanetToggle(e) {
    let p = e.target.id;
    this.planetToggle(p);
  }
  handleStructureToggle(e) {
    let s = e.target.id;
    this.structureToggle(s);
  }


  //generating stuff
  async generateSystem(name="Alpha Centauri", num=3) {
    const bDatabase = {...this.state.world.bDatabase};
    if (!bDatabase[name]) {
      let system = [];
      let rngData = rngBody(name, "star");
      let star = {data: {...rngData}, index: 0, parent: 0, active: false}
      system.push(star);
      for (let i=1;i<num+1;i++) {
        let parent = Math.floor(seedrandom(i.toString()).quick()*(i/num)*4);
        let rngData = rngBody(name+" "+i.toString(), "planet", 1/(parent/2+1));
        //smaller scale for outlying moons
        // console.log(rngData);
        let planet = {data: {...rngData}, index: i, parent: parent, active: false};
        system.push(planet);
      }
      // console.log(system);
      return system;
    }
    else { return null }
  }

  async genSysStructures(name="Alpha Centauri", num=4) {
    const sDatabase = {...this.state.world.sDatabase};
    if (!sDatabase[name]) {
      let sysStruct = [];

      for (let i=0;i<num;i++) {
        // let parent = Math.floor(seedrandom(i.toString()).quick()*(i/num)*4);
        let rngData = rngStruct(name+" "+i.toString());
        //smaller scale for outlying moons
        // console.log(rngData);
        let struct = {data: {...rngData}, index: i, openings: 1, active: false};
        // console.log(struct);
        sysStruct.push(struct);
      }
      // console.log(system);
      return sysStruct;
    }
    else { return null }
  }

  async createGalaxy(starlist=[{name:"Wolf 359",num:6},{name:"Tau Ceti",num:4},{name:"Groombridge",num:1}]) {
    console.log(starlist)
    const bDatabase = {...this.state.world.bDatabase};
    const sDatabase = {...this.state.world.sDatabase};
    for (let n of starlist) {
      let system = await this.generateSystem(n.name,n.num);
      let sysStruct = await this.genSysStructures(n.name,3);
      bDatabase[n.name] = system;
      sDatabase[n.name] = sysStruct;
    }
    console.log(bDatabase);
    console.log(sDatabase);

    return this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          bDatabase: bDatabase,
          sDatabase: sDatabase,
        }
      }
    });
  }

  loadStagePlanets(stage) {
    const pending = [];
    const bDatabase = {...this.state.world.bDatabase};
    const db = bDatabase[stage];
    // const [dbstar, ...dbplanets] = db;
    const dbplanets = db.slice(1);
    //the active check doesn't fit the rest of the logic, gotta change something
    if (dbplanets) {
      for (let planet of dbplanets) {
        if (planet.active&&db[planet.parent].active) {
          pending.push(planet);
        }
      };
    }
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          pendingBodies: pending,
          stage: stage,
        }
      }
    });
  }

  loadStageStructures(stage) {
    const pending = [];
    const sDatabase = {...this.state.world.sDatabase};
    const db = sDatabase[stage];
    if (db) {
      for (let struct of db) {
        // console.log(struct)
        if (struct.active) {
          pending.push(struct);
        }
      };
    }
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          structures: [],
          pendingStructures: pending,
        }
      }
    });
  }

  async loadStage(stage="Sol") {
    await this.createPrimary(this.state.world.bDatabase[stage][0].data);
    this.loadStagePlanets(stage);
    this.loadStageStructures(stage);
    this.addCoreEmitter();
    return this.continueGame();
  }

  //moving around the galaxy
  systemChange(target) {
    const currStage = this.state.world.stage;
    const bDatabase = {...this.state.world.bDatabase};
    const sDatabase = {...this.state.world.sDatabase};
    const bdb = bDatabase[currStage];
    const sdb = sDatabase[currStage];
    const bdb2 = bDatabase[target];
    const sdb2 = sDatabase[target];
    for (let b of bdb) {
      b.active = false;
    }
    if (sdb) {
      for (let s of sdb) {
        s.active = false;
      }
    }
    for (let b of bdb2) {
      b.active = true;
    }
    if (sdb2) {
      for (let s of sdb2) {
        s.active = true;
      }
    }
    this.setState((prevState) => {
      return {
        // inGame: 'loading',
        world: {
          ...prevState.world,
          bDatabase: bDatabase,
          sDatabase: sDatabase,
        },
        ball: {
          ...prevState.ball,
          x: prevState.screen.width/4,
          y: prevState.screen.height/3
        }
      }
    });
    this.loadStage(target);
    // console.log(target);
    // console.log(this.state.inGame);
  }

  async createPrimary(data) {
    const star = new Body(data);
    star.index = 0;
    const bodies = [];
    bodies.push(star);
    return this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          bodies: bodies,
          stage: data.name,
        }
      }
    });
  }

  //planet and star make/toggle
  createPlanet(data=null,parent=0,index=this.state.world.bodies.length,em=null) {
    const bodies = [...this.state.world.bodies];
    // console.log(data);
    bodies[index] = new Body(data,bodies[parent]);
    bodies[index].index = index;
    bodies[index].emitter = this.createNewEmitter(em);
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          bodies: bodies,
        }
      }
    });
  }

  updatePlanets() {
    const pending = [...this.state.world.pendingBodies];
    for (let i=0;i<pending.length;i++) {
      let p = pending.splice(0,1)[0];
      if (!p.em) {
        p.em = { target: p.index, e: 600, color1: shadeColor(p.data.hue,80), rate1: 6, rate2: 1.5, velocity: 1.5, damp: 0.007, life: 7, mass: 5 };
      }
      this.createPlanet(p.data,p.parent,p.index,p.em||null);
    }
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          pendingBodies: pending,
        }
      }
    });
  }

  planetToggle(p) {
    // let p = e.target.id;
    const bodies = [...this.state.world.bodies];
    // const [star, ...planets] = bodies;
    const planets = bodies.slice(1);
    const stage = this.state.world.stage;
    const bDatabase = {...this.state.world.bDatabase};
    const db = bDatabase[stage];
    const target = db.find( b => b.data.name === p );
    if (!target.active&&bodies[target.parent]) {
      db[target.index].active = true;
      const pending = [...this.state.world.pendingBodies];
      pending.push(target);
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            pendingBodies: pending,
            bDatabase: bDatabase
          }
        }
      });
    }
    else if (target.active) {
      //disables any active children. but the star is exempt even if it's its own parent by default
      for (let body of planets) {
        if (body&&body.parent===bodies[target.index]) {
          let i = body.index;
          db[i].active = false;
          bodies[i] = null;
        }
      }
      db[target.index].active = false;
      bodies[target.index] = null;
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            bodies: bodies,
            bDatabase: bDatabase,
          }
        }
      });
    }
  }

  //structure make/toggle
  createStructure(data=null,openings=0,index=this.state.world.structures.length) {
    const structures = [...this.state.world.structures];
    structures[index] = new ringStructure(data);
    structures[index].addSegments(openings);
    structures[index].index = index;
    // console.log(structures[index])
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          structures: structures,
        }
      }
    });
  }

  updateStructures() {
    const ps = [...this.state.world.pendingStructures];
    const structures = [...this.state.world.structures];
    for (let i=0;i<ps.length;i++) {
      let p = ps.splice(0,1)[0];
      // console.log(p.data)
      // this.createStructure(p.data,p.openings,p.index);
      structures[p.index] = new ringStructure(p.data);
      structures[p.index].addSegments(p.openings);
      structures[p.index].index = p.index;
    }
    // console.log(structures)
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          structures: structures,
          pendingStructures: ps,
        }
      }
    });
  }

  structureToggle(s) {
    const structures = [...this.state.world.structures];
    const stage = this.state.world.stage;
    const sDatabase = {...this.state.world.sDatabase};
    const db = sDatabase[stage];
    const target = db.find( struct => struct.data.name === s );
    // console.log(structures)
    if (!target.active) {
      db[target.index].active = true;
      const pending = [...this.state.world.pendingStructures];
      pending.push(target);
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            pendingStructures: pending,
            sDatabase: sDatabase,
          }
        }
      });
    } else if (target.active) {
      db[target.index].active = false;
      structures[target.index] = null;
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            structures: structures,
            sDatabase: sDatabase,
          }
        }
      });
    }
  }

  //proton stuff
  defineEB() {
    // let mouseAttract = new Proton.Attraction(this.state.mouseObj, 5, 200);
    this.sharedEB.borderZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.state.screen.width, this.state.screen.height), 'bound');
    this.sharedEB.randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    const centerZone = this.state.world.bodies[0]?{
      x: this.state.world.bodies[0].x,
      y: this.state.world.bodies[0].y,
    }:{
      x: 350,
      y: 350,
    }
    // console.log(centerZone);
    this.sharedEB.centerBehaviour = new Proton.Repulsion(centerZone, 30, this.state.world.bodies[0]?this.state.world.bodies[0].size*2:30)
    // return this.sharedEB.push(borderZoneBehaviour,randomBehaviour,centerBehaviour)
    return this.sharedEB
  }

  createNewEmitter({target=null, color1=null, color2=null, mass=5, radius=1, velocity=2.5, rate1=20, rate2=0.5, damp=0.005, e='once', life=5, planetAttraction=true, x=350, y=350, a=0, b=360}={}, special=false) {
    let emitter = new Proton.Emitter();


    emitter.e = e;
    emitter.damping = damp;
    emitter.rate = new Proton.Rate(new Proton.Span(rate1, rate1*1.5), rate2);
    emitter.addInitialize(emitter.rate);
    emitter.addInitialize(new Proton.Mass(mass));
    emitter.addInitialize(new Proton.Radius(radius));
    if (life) { emitter.addInitialize(new Proton.Life(life)) }
    emitter.currVelocity = new Proton.Velocity(new Proton.Span(velocity, velocity*1.5), new Proton.Span(a, b), 'polar');
    emitter.addInitialize(emitter.currVelocity);
    let c = color1?(new Proton.Color(color1, color2||color1)):(new Proton.Color('random'));
    emitter.addBehaviour(c);
    // let borderZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.state.screen.width, this.state.screen.height), 'bound');
    if (this.sharedEB.borderZoneBehaviour) { emitter.addBehaviour(this.sharedEB.borderZoneBehaviour) }
    // let randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    // emitter.addBehaviour(randomBehaviour);
    if (this.sharedEB.randomBehaviour) { emitter.addBehaviour(this.sharedEB.randomBehaviour) }
    // let rect = new Proton.RectZone(this.state.screen.width/2,this.state.screen.height/2,this.state.world.bodies[0].size);
    // let centerZone = {
    //   x: this.state.world.bodies[0].x||350,
    //   y: this.state.world.bodies[0].y||350,
    // }
    // let centerBehaviour = new Proton.Repulsion(centerZone, 30, this.state.world.bodies[0].size*2)
    // emitter.addBehaviour(centerBehaviour);
    if (this.sharedEB.centerBehaviour) { emitter.addBehaviour(this.sharedEB.centerBehaviour) }
    if (special==='core') {
      emitter.coreAttraction = new Proton.Attraction(this.state.world.bodies[0], 10, 500);
      emitter.addBehaviour(emitter.coreAttraction);
    } else if (special==='psi') {
      emitter.planetAttraction = new Proton.Attraction(this.state.world.bDatabase[this.state.world.stage][target].data, 10, 500);
      emitter.addBehaviour(emitter.planetAttraction);
    } else if (planetAttraction&&target!==null) {
      emitter.planetAttraction = new Proton.Attraction(this.state.world.bDatabase[this.state.world.stage][target].data, 10, 500);
      emitter.addBehaviour(emitter.planetAttraction);
    }
    emitter.target = target||0;
    if (target) {
      //proper initialization TBD
      emitter.mouseAttract = new Proton.Attraction(this.state.mouseObj, 5, 200);
      emitter.addBehaviour(emitter.mouseAttract);
      // emitter.p.x = this.state.screen.width/2;
      // emitter.p.y = this.state.screen.width/2;
      emitter.p.x = x;
      emitter.p.y = y;
    };
    if (!target) {
      emitter.mouseAttract = new Proton.Attraction(this.state.mouseObj, 5, 200);
      emitter.addBehaviour(emitter.mouseAttract);
      emitter.p.x = x;
      emitter.p.y = y;
    };
    // console.log(emitter.behaviours);
    return emitter;
  }

  makePsiEmitter() {
    this.setState((prevState) => {
      return {
        proton: {
          ...prevState.proton,
          psiEmitter: this.createNewEmitter({ e: 'once', color1: '#6699FF', color2: '#FFDDFF', rate1: 50, rate2: 0.01, velocity: 1, mass: 8, radius: 1, damp: 0.009, life: (1,5), special:'psi'}),
        }
      }
    });
  }

  addCoreEmitter() {
    this.setState((prevState) => {
      return {
        proton: {
          ...prevState.proton,
          coreEmitter: this.createNewEmitter({target:0, special:'core', e: 2, color1: shadeColor(this.state.world.bodies[0].hue,40,-10,-10), rate1: 6, rate2: 0.6, velocity: 1.8, damp: 0.014, life: 20, mass: 15, radius: 4, planetAttraction: true, a:_.random(-330,-30)+30, b:_.random(30,330)-30 }),
        }
      }
    });
  }

  emitterParticleCheck(emitter=this.state.proton.psiEmitter,target=this.state.world.bodies[0],sample=16) {
    let length = emitter.particles.length;
    let centerBehaviour = new Proton.Repulsion(this.state.world.bodies[0], 50, this.state.world.bodies[0].size*15)
    if (length>sample) {
      for (let i=0;i<(length/sample)-1;i++) {
        let particle = emitter.particles[length-(i*sample+1)];
        // console.log(particle);
        if (!particle.dead&&(objectDistance(particle.p,target)<target.size*5)) {

          // let repulsion = particle.behaviours.find( b => b.name === "Repulsion" );
          // repulsion.reset(this.state.world.bodies[0], 100, 100)
          // let color = particle.behaviours.find( b => b.name === "Color" );
          // let solar = particle.behaviours.find( b => b.name === "Attraction" && (b.targetPosition instanceof Body) );
          // particle.removeBehaviour(solar);
          // particle.removeBehaviour(color)
          // particle.removeAllBehaviours();
          particle.addBehaviour(new Proton.Color('#39F654', '#49FF88'))
          particle.mass*=2;
          particle.energy*=3;

          particle.addBehaviour(centerBehaviour)
          this.setState((prevState) => {
            return {
              resources: {
                ...prevState.resources,
                matter: prevState.resources.matter+1,
              }
            }
          });
        }
      }
    }
  }

  //motion stuff
  thrustInput() {
    let tx = 0;
    let ty = 0;
    if (this.state.keys.up) {
      ty -= this.state.ball.thrustAcc*Math.pow(this.state.keys.up, 0.5);
    }
    if (this.state.keys.down) {
      ty += this.state.ball.thrustAcc*Math.pow(this.state.keys.down, 0.25);
    }
    if (this.state.keys.left) {
      tx -= this.state.ball.thrustAcc*Math.pow(this.state.keys.left, 0.25);
    }
    if (this.state.keys.right) {
      tx += this.state.ball.thrustAcc*Math.pow(this.state.keys.right, 0.25);
    }
    if (tx||ty) {
      // this.setState((prevState) => {
      //   return {
      //     ball: {
      //       ...prevState.ball,
      //       vx: prevState.ball.vx + tx,
      //       vy: prevState.ball.vy + ty,
      //     }
      //   }
      // })
    }
    return [tx, ty]
  }

  borderCollision(object) {
    const bounce = this.state.params.bounceDampening*0.7;
    const width = this.state.screen.width
    const height = this.state.screen.height
    if (object.x+object.vx > width - object.size || object.x+object.vx < object.size) {
      if (object.x+object.vx<width/-10||object.x+object.vx>width*1.1) {
        //return from OOB
        console.log('OOB X')
        this.setState((prevState) => {
          return {
            ball: {
              ...prevState.ball,
              x: (object.x+object.vx)>0?width*Math.sqrt(bounce):width/5*(1+bounce/5),
              y: (object.y+object.vy)>0?height*Math.sqrt(bounce):height/5*(1+bounce/5),
              vx: prevState.vx*0.05,
              vy: prevState.vy*0.05,
            }
          }
        });
      }
      // else {
        //normal bounce
        // this.setState((prevState) => {
        //   return {
        //     ball: {
        //       ...prevState.ball,
        //       x: prevState.ball.x -prevState.ball.vx*bounce*2,
        //       y: prevState.ball.y -prevState.ball.vy*bounce*2,
        //     }
        //   }
        // });
      // }
      return [-1, 1]
    }
    if (object.y+object.vy > height - object.size || object.y+object.vy < object.size) {
      if (object.y+object.vy<height/-10||object.y+object.vy>height*1.1) {
        //return from OOB
        console.log('OOB Y')
        this.setState((prevState) => {
          return {
            ball: {
              ...prevState.ball,
              x: (object.x+object.vx)>0?width*Math.sqrt(bounce):width/5*(1+bounce/5),
              y: (object.y+object.vy)>0?height*Math.sqrt(bounce):height/5*(1+bounce/5),
              vx: prevState.vx*0.05,
              vy: prevState.vy*0.05,
            }
          }
        });
      }
      // else {
        //normal bounce
        // this.setState((prevState) => {
        //   return {
        //     ball: {
        //       ...prevState.ball,
        //       x: prevState.ball.x -prevState.ball.vx*bounce*2,
        //       y: prevState.ball.y -prevState.ball.vy*bounce*2,
        //     }
        //   }
        // });
      // }
      return [1, -1]
    }
    return [1, 1]
  }

  ballGravPull(object, targets) {
    let gx = 0;
    let gy = 0;
    for (let body of targets) {
      if (body) {
        let dist = objectDistance(object, body);
        gx += body.mass*towardsBody(object, body).x/Math.pow(dist * this.state.params.gravFalloff, 2);
        gy += body.mass*towardsBody(object, body).y/Math.pow(dist * this.state.params.gravFalloff, 2);
      }
    }
    // this.setState((prevState) => {
    //   return {
    //     ball: {
    //       ...prevState.ball,
    //       vx: prevState.ball.vx - gx,
    //       vy: prevState.ball.vy - gy,
    //     }
    //   }
    // })
    return [-gx, -gy]
  }

  structCollisionCheck() {
    let ball = this.state.ball;
    let angle = (Victor(ball.x-this.props.width/2, ball.y-this.props.height/2).horizontalAngle()+Math.PI*2)%(Math.PI*2);
    // let coll = false;
    let structures = [...this.state.world.structures]
    for (let struct of this.state.world.structures) {
      if (struct && objectDistance(ball,struct.origin) > struct.radius-struct.width/2-ball.size && objectDistance(ball,struct.origin) < struct.radius+struct.width/2+ball.size) {
        let arcLength = (((struct.segments[0].bc-struct.segments[0].ac)*struct.dir+Math.PI*3)%(Math.PI*2)-Math.PI);
        for (let seg of struct.segments) {
          let angleDiff = struct.speed>0?
          ((angle-seg.ac)+Math.PI*3)%(Math.PI*2)-Math.PI:
          (-(angle+seg.bc)+Math.PI*3)%(Math.PI*2)-Math.PI;
          if (seg.health>0&&((angleDiff>0&&angleDiff<arcLength)||(angleDiff<0&&angleDiff>Math.PI-arcLength))) {
            // console.log(struct);
            // console.log('hit');
            seg.health--;
            if (seg.health===0) {
              seg.health = -6;
              console.log('segment disabled!')
            }
            return this.structCollState(struct.index);
          }
        }
      }
    }
    //still run it to reset state if needed
    return this.structCollState(false);
  }

  structCollState(coll) {
    const bounce = this.state.params.bounceDampening*0.8;
    if (coll!==false) {
      //collision continues, increment tick:
      if (this.state.ball.coll!==false) {
        if (this.state.tick%3===0) {
        this.setState((prevState) => {
          return {
            ball: {
              ...prevState.ball,
              ct: prevState.ball.ct+1,
            }
          }
        })
        return  [1*(1+this.state.ball.ct/10)*bounce,1*(1+this.state.ball.ct/10)*bounce]
        }
        return [1, 1]
      } else {
        //collision begins:
        this.setState((prevState) => {
          return {
            ball: {
              ...prevState.ball,
              coll: coll,
              ct: 1,
            }
          }
        })
        return [-1*bounce,-1*bounce]
      }
    }
    //"NO COLLISION! Fake News!" - Donald J. Trump
    else {
      if (this.state.ball.coll!==false) {
        this.setState((prevState) => {
          return {
            ball: {
              ...prevState.ball,
              coll: false,
              ct: 0,
            }
          }
        })
      }
      return [1, 1]
    }
  }

  planetMotion() {
    const bodies = [...this.state.world.bodies];
    //apply a pulling force, costs energy
    if (this.state.mousedown && this.state.resources.energy > 0 && this.state.mouseTick%2===0) {
      for (let planet of bodies) {
        if (planet) {
          planet.getsPulled(9, this.state.mouseObj, this.state.mouseTick)
        }
      }
      this.setState((prevState) => {
        return {
          resources: {
            ...prevState.resources,
            energy: prevState.resources.energy-1,
          }
        }
      })
    };
    //normal motion
    for (let planet of bodies) {
      if (planet) {
        //normal motion first
        if (planet.speed!==0&&planet.type!=='star') {
          planet.movePlanet();
        }
        let otherBodies = bodies.filter(item => item !== planet);
        for (let body of otherBodies) {
          if (body) {
            //have to think about handling it better
            if (objectDistance(planet, body)*0.95 < body.size + planet.size) {
              return this.planetCollision(planet, body, 2);
            }
          }
        }
      }
    };
  }

  planetCollision(origin, body, type) {
    if (type === 1) {
      const bounce = this.state.params.bounceDampening*0.9;
      if (objectDistance(origin, body)*0.95 < body.size + origin.size) {
        this.setState((prevState) => {
          return {
            currentScore: prevState.currentScore + 1,
            // ball: {
            //   ...prevState.ball,
              // x: prevState.ball.x-(prevState.ball.vx * bounce*0.5),
              // y: prevState.ball.y-(prevState.ball.vy * bounce*0.5),
              // vx: -prevState.ball.vx * this.state.params.bounceDampening,
              // vy: -prevState.ball.vy * this.state.params.bounceDampening,
            }

        })
        return [-1*bounce, -1*bounce]
      }
      return [1, 1]
    } else if (type === 2 && objectDistance(origin, body)*0.96 < body.size + origin.size) {
      return this.setState((prevState) => {
        let bodies = [...prevState.world.bodies];
        let b = bodies[bodies.indexOf(body)];
        let o = bodies[bodies.indexOf(origin)];
        if (o.speed) {
          o.dx += towardsBody(origin, body).x*(o.coll*o.size/8)*(b.mass/o.mass);
          o.dy += towardsBody(origin, body).y*(o.coll*o.size/8)*(b.mass/o.mass);
          o.coll += 2;
        }
        // if (b.speed) {
        // TBD
        // }
        return {
          resources: {
            ...prevState.resources,
            matter: prevState.resources.matter+1,
          },
          bodies: bodies,
        }
      });
    }
  }

  ballCheckPlanets() {
    const bodies = this.state.world.bodies;
    const ball = this.state.ball;
    let pcx = 0;
    let pcy = 0;
    for (let body of bodies) {
      if (body) {
        let [cx,cy] = this.planetCollision(ball, body, 1)
        if (cx!==1||cy!==1) {
          pcx += cx
          pcy += cy
        }
      }
    }
    if (pcx||pcy) {
      return [pcx,pcy]
    }
    return [1,1]
  }

  moveBall() {
    const ball = this.state.ball;
    const bodies = this.state.world.bodies;
    const bounce = this.state.params.bounceDampening;

    let g = this.ballGravPull(ball, bodies);
    let t = this.thrustInput();

    let vx = this.state.ball.vx+g[0]+t[0];
    let vy = this.state.ball.vy+g[1]+t[1];

    let bc = this.borderCollision(ball);
    if (bc[0]!==1||bc[1]!==1) {
      //bounce off borders first
      vx *= -1*bounce*0.5;
      vy *= -1*bounce*0.5;
      return this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            x: prevState.ball.x + vx*0.5,
            y: prevState.ball.y + vy*0.5,
            vx: vx,
            vy: vy,
          }
        }
      })
    }
    else {
    let sc = this.structCollisionCheck();
    let pc = this.ballCheckPlanets();
    // have to fix multiple bounce types, this is so messy
    if (sc[0]<0&&pc[0]<0) {
      vx *= -sc[0]*pc[0];
      vy *= -sc[1]*pc[1];
    } else {
    vx *= sc[0]*pc[0];
    vy *= sc[1]*pc[1];
    }
    const speed = objectDistance(ball, {x: vx, y:vy});
    return this.setState((prevState) => {
      return {
        // ...prevState,
        ball: {
          ...prevState.ball,
          // will rewrite this completely
          x: prevState.ball.x + vx + (prevState.ball.vx/4)*(sc[0]-1)+(prevState.ball.vx/4)*(pc[0]-1),
          y: prevState.ball.y + vy + (prevState.ball.vy/4)*(sc[1]-1)+(prevState.ball.vy/4)*(pc[0]-1),
          vx: vx,
          vy: vy,
          speed: speed,
        }
      }
    })
    }
  }

  handlePauseStart() {
    if (this.state.inGame === false) {
      this.continueGame();
      console.log("continue");
    } else if (this.state.inGame === true) {
      this.stopGame();
      console.log("pause");
    }
  }

  //primary logic loop
  continueGame() {
    requestAnimationFrame((t) => {this.update(t)});
    this.setState(() => {
      return { inGame: true, }
    });
  }

  stopGame() {
    clearInterval(this.timerID);
    cancelAnimationFrame(this.animationID);
    this.setState(() => {
      return { inGame: false, }
    });
  }

  //React own methods
  componentDidMount() {
    window.addEventListener('keyup',   this.handleKeys.bind(this, false));
    window.addEventListener('keydown', this.handleKeys.bind(this, true));
    // window.addEventListener('resize',  this.handleResize.bind(this, false));
    this.setState(() => {
      return { inGame: "loading", }
    });
    this.defineEB();
    // console.log(this.sharedEB)
    this.createGalaxy(this.state.starList);
    this.loadStage("Sol");
    this.makePsiEmitter();
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.animationID);
  }

  //just testing
  // async nextFrame(t) {
  //   return new Promise(resolve => {
  //     requestAnimationFrame((t) => {this.update(t)})
  //   })
  // }

  async update(t) {
    //animInterval is the framerate setting, only do stuff if it's exceeded
    let delta = t - this.state.ts;
    if (delta > animInterval) {
      this.setState((prevState) => {
        return {
          ts: t - (delta % animInterval),
          tick: prevState.tick + 1,
          mouseTick: prevState.mousedown ? prevState.mouseTick+1 : 0,
          mouseReleased: !prevState.mousedown&&prevState.mouseTick>0 ? true : false,
        }
      });
      if (this.state.world.pendingBodies.length>0) {
        this.updatePlanets();
      };
      if (this.state.world.pendingStructures.length>0) {
        this.updateStructures();
      };
      this.planetMotion();
      for (let layer of this.state.world.structures) {
        if (layer) {
          layer.moveSegments();
        }
      }
      this.moveBall();
      if (this.state.proton.psiEmitter.particles.length>8&&this.state.tick%50===0) {
        this.emitterParticleCheck(this.state.proton.psiEmitter,this.state.world.bodies[0],4);
      }
    }
    // if (this.state.inGame === "loading") {
    //   console.log("loading")
    // }
    if (this.state.inGame === true) {
      return this.animationID = requestAnimationFrame((t) => {this.update(t)});
      // return this.animationID = await this.nextFrame(t);
    }
  }

  render() {
    //UI elements
    const ui = {
      tick: this.state.tick,
      ts: this.state.ts,
      inGame: this.state.inGame,
      currentScore: this.state.currentScore,
      stage: this.state.world.stage,
      ball: this.state.ball,
      resources: this.state.resources,
      mousedown: this.mousedown,
    };

    const stage = this.state.world.stage;

    // const starList = [...this.state.starList];
    // starList.push({name:'Sol',num:6})
    // const starTravelList = starList.map(
    //   (star) =>
    //   <StarButton onClick={this.handleSystemChange} star={star.name} ui={ui} />
    // )
    const starTravelList = this.makeMapInterface(ui);

    const bDatabase = {...this.state.world.bDatabase}
    const planetList = bDatabase[stage]&&bDatabase[stage].length>0?bDatabase[stage].slice(1).map(
      (planet) =>
      <PlanetButton onClick={this.handlePlanetToggle} body={planet}/>
    ):
    null;
    // {planetList}
    const sDatabase = {...this.state.world.sDatabase}
    const structList = sDatabase[stage]?sDatabase[stage].map(
      (struct) =>
      <StructureButton onClick={this.handleStructureToggle} struct={struct} />
    ):
    null;
    const selectionInfo = this.state.selectedObj?
    <InfoBox style={{ color: '#05051A', backgroundColor: '#DACFDA', textAlign:'left', listStyle:'none', padding:'0.3em 0.6em',margin:'0.5em auto 0.5em 3em',minWidth:'30%'}} obj={this.state.selectedObj} />:
    <span style={{minWidth:'30%',margin:'0.5em auto 0.5em 3em'}}>{`Click on an in-system body for an info box`}</span>;
    const pauseButton = this.state.inGame ?
    <Button onClick={this.handlePauseStart} style={{ backgroundColor: 'red' }} text="Pause" /> :
    <Button onClick={this.handlePauseStart} text="Continue" />;
    const sparkleButton = <Button onClick={this.handleChargePsi} style={{ backgroundColor: '#4666FF' }} text={`Psi blasts: ${this.state.resources.psi}`} />;
    const chargeButton = <Button onClick={this.handlePowerChange} style={{ backgroundColor: '#E0115F' }} text={`Energy: ${this.state.resources.energy} (click to charge)`} />;
    const canvasCheck = this.state.world.bodies[0]?
    <GameCanvas onMouseDown={this.mousedownHandler} onMouseUp={this.mouseupHandler} onMouseMove={this.mousemoveHandler} style={{ background: "#36454F" }} {...this.state} />
    :null;

    return (
      <div className="showcase">
      {canvasCheck}
      <GUIWrap ui={ui}>

      <Modal
      isOpen={this.state.showModal}
      contentLabel="onRequestClose Example"
      onRequestClose={this.handleCloseModal}
      shouldCloseOnOverlayClick={true}
      style={{ content: {
          backgroundColor: '#30405E',
          maxWidth: '30%'
        } }}
      ui={ui}>
      <h2 style={{fontColor: '#C0C0EE', margin:'0.5em', textAlign:'center'}}>Galaxy map</h2>

      <ButtonBlock ui={ui}>
        {starTravelList}
      </ButtonBlock>
      <button style={{backgroundColor: '#30405E', padding:'0.2em', margin:'2em 0.5em 0.5em'}} onClick={this.handleCloseModal}>Close</button>
      </Modal>
      <StatsDisplay ui={ui} />
      <p>WASD to accelerate</p>
      <Controls ui={ui}>
      <ButtonBlock ui={ui}>
      {pauseButton}{sparkleButton}{chargeButton}
      </ButtonBlock>
      <ButtonBlock ui={ui}>
      {structList}
      </ButtonBlock>
      <ButtonBlock ui={ui}>
        {planetList}
      </ButtonBlock>
      </Controls>
      <Button onClick={this.handleOpenModal} style={{fontSize:'1.3em',alignSelf:'center',backgroundColor: '#30405E', padding:'0.5em',margin:'0.6em auto',borderRadius:'1px'}} text="GALAXY MAP"/>
      {selectionInfo}
      </GUIWrap>
      </div>
    );
  };
};

//interface
const GUIWrap = ({ ui, children }) => (
  <div className="game-interface">
  {children}
  </div>
);
const StatsDisplay = ({ ui }) => (
  <div className="interface-element" style={{fontSize:"1.1em",margin:'0.2em auto',width:"100%",padding:"0.1em",transitionDuration:'0'}}>
  <p style={{textAlign:'left'}}>{`Stage: ${ui.stage} || Energy: ${ui.resources.energy} || Matter: ${ui.resources.matter} || Psi: ${ui.resources.psi} || Score: ${ui.currentScore}`}</p>
  </div>
);

const InfoBox = ({ style, obj }) => (
  <section style={style}>
  <li>
  <ul>{`Name: ${obj.name}`}</ul>
  <ul>{`Mass: ${obj.mass}`}</ul>
  <ul>{`Coordinates: X ${obj.x.toFixed(1)}|| Y ${obj.y.toFixed(1)}`}</ul>
  <ul>{`Type: ${obj.type}`}</ul>
  </li>
  </section>
);

const Controls = ({ children }) => (
  <div className="game-controls" style={{padding:'0.1em',margin:'0.1em'}}>
  {children}
  </div>
);
const ButtonBlock = ({ ui, children }) => (
  <div className="interface-element">
  {children}
  </div>
);
const Button = ({ onClick, text, style, id }) => (
  <button onClick={onClick} type="button" style={style} id={id}>
  {text}
  </button>
);
const StarButton = ({ onClick, star, ui }) => (
  <button onClick={onClick} type="button" style={ui.stage===star?{backgroundColor: '#DD1133'}:{backgroundColor: '#4422EE'}} id={star}>
  Load system: {star}
  </button>
);
const PlanetButton = ({onClick, body}) => (
  <button onClick={onClick} style={{backgroundColor: `${shadeColor(body.data.hue,-20)}`}} id={body.data.name}>Toggle planet: {body.data.name}</button>
);
const StructureButton = ({onClick, struct}) => (
  <button onClick={onClick} style={{backgroundColor: `${shadeColor(struct.data.hue,-40)}`}} id={struct.data.name}>Toggle structure: {struct.data.name}</button>
);

//planet data
const marsData = {
  size: 9,
  orbitX: 200,
  orbitY: 160,
  rot: 200,
  speed: -1.5,
  mass: 100,
  hue: "#ff4336",
  glow: 0.8,
  angle: 0,
  name: "Mars",
}

const phobosData = {
  size: 6,
  orbitX: 35,
  orbitY: 32,
  rot: 100,
  speed: 1.5,
  mass: 50,
  hue: "#EE1111",
  glow: 0.6,
  angle: 40,
  name: "Phobos",
}

const venusData = {
  size: 12,
  orbitX: 105,
  orbitY: 90,
  rot: 205,
  speed: 1,
  mass: 165,
  hue: "#00A86B",
  glow: 0.8,
  angle: 10,
  name: "Venus",
}

const earthData = {
  size: 11,
  orbitX: 155,
  orbitY: 140,
  rot: 20,
  speed: 1,
  mass: 150,
  hue: "#007FFF",
  glow: 1.2,
  angle: 20,
  name: "Earth",
}

const solData = {
  size: 19,
  orbitX: 0,
  speed: 0,
  mass: 220,
  hue: "#FFCC33",
  glow: 2.5,
  angle: 0,
  name: "Sol",
}

const saturnData = {
  size: 14,
  orbitX: 310,
  speed: 0.5,
  mass: 190,
  hue: "#d9b47d",
  glow: 1,
  angle: 210,
  name: "Saturn",
}

function rngBody(seed, type="planet", scale=1, rstate=false) {
  let rng = seedrandom(seed, {state: rstate})
  if (type==="star") {
    return {
      orbitX: 0,
      speed: 0,
      size: Math.floor((rng.quick()*17+10)*scale),
      mass: Math.floor((rng.quick()*200+60)*scale),
      hue: "#"+((rng.int32().toString(16)).slice(-6)),
      glow: 1.5,
      name: seed+" Primary",
      rngstate: rstate?rng.state:null,
    }
  }
  let ox = Math.floor(rng.quick()*300*Math.pow(scale, 0.5));
  return {
    orbitX: ox,
    orbitY: ox-Math.floor(3+rng.quick()*15*Math.pow(scale, 2.5)),
    rot: Math.floor(330*rng.quick()),
    angle: Math.floor(330*rng.quick()),
    speed: +((rng.quick()*1.5+0.3)/scale).toFixed(1),
    size: Math.floor((rng.quick()*12+4)*Math.pow(scale, 1.25)),
    mass: Math.floor((rng.quick()*150+40)*scale),
    hue: shadeColor("#"+((rng.int32().toString(16)).slice(-6)),20),
    glow: Math.floor(20*rng.quick())/20,
    name: seed,
    rngstate: rstate?rng.state:null,
  }
}

class Body {
  constructor(data, parent=null) {
    this.data = data;
    this.parent = parent;
    this.xPar = this.parent ? this.parent.x : data.xPar||350;
    this.yPar = this.parent ? this.parent.y : data.yPar||350;
    this.size = data.size||15;
    this.orbitX = data.orbitX||0;
    this.orbitY = data.orbitY||this.orbitX;
    this.type = data.orbitX>0 ? "planet" : "star";
    this.rot = data.rot||0;
    if (this.orbitX!==this.orbitY) {
      this.e = Math.sqrt(1 - (Math.pow(this.orbitY, 2)/Math.pow(this.orbitX, 2)));
      this.pfdist = new Victor(this.orbitX*this.e, 0)
      this.pfdist.rotateDeg(this.rot);
      this.pf = {
        x: this.xPar + this.pfdist.x,
        y: this.yPar + this.pfdist.y,
      }
      this.per = this.orbitX-this.orbitX*this.e;
      this.aph = this.orbitX+this.orbitX*this.e;
    }
    this.speed = data.speed||0;
    this.speedWarp = 0;
    this.mass = data.mass||0;
    this.hue = data.hue||"#FFFF00";
    this.glow = data.glow||0;
    this.name = data.name||"Unknown";
    this.angle = data.angle||0;
    this.dir = this.speed>0?1:-1;
    this.x = this.xPar + this.orbitX;
    this.y = this.yPar + this.orbitY;
    this.dx = 0;
    this.dy = 0;
    this.coll = 0;
    console.log("creating body: "+this.name);

    this.rngstate = data.rngstate||0;
  }

  getsPulled(force, target, tick=0) {
    let dist = objectDistance(this, target);
    let fade = 1+(tick*0.05)
    this.speedWarp = (force*200/this.mass)/(Math.pow(dist * 0.5, 1.1)*fade);
    if (dist > this.size*2*fade)  {
      this.dx -= force*towardsBody(this, target).x/(Math.pow(dist * 0.04, 1.1)*fade);
      this.dy -= force*towardsBody(this, target).y/(Math.pow(dist * 0.04, 1.1)*fade);
    }
  }

  movePlanet() {
    this.angle += this.orbitX===this.orbitY ?
    (Math.acos(1 - Math.pow((this.speed/(1+this.speedWarp))/this.orbitX, 2)/2)%Math.PI*2)*this.dir :
    (Math.acos(1 - Math.pow((this.speed*(1+this.e*Math.cos(this.angle))/(1+this.speedWarp))/this.orbitX, 2)/2)%Math.PI*2)*this.dir;

    if (this.parent) {
      this.xPar = this.parent.x;
      this.yPar = this.parent.y;
      if (this.orbitX!==this.orbitY) {
        this.xPar -= this.pfdist.x;
        this.yPar -= this.pfdist.y;
      }
    }
    if (this.orbitX===this.orbitY) {
      this.x = this.xPar + this.orbitX * Math.cos(this.angle) + this.dx;
      this.y = this.yPar + this.orbitY * Math.sin(this.angle) + this.dy;
    }
    else {
      let el = new Victor(this.orbitX * Math.cos(this.angle), this.orbitY * Math.sin(this.angle))
      el.rotateDeg(this.rot)
      this.x = this.xPar + el.x + this.dx;
      this.y = this.yPar + el.y + this.dy;
    }
    if (this.dx) {
      this.dx = Math.abs(this.dx)>1 ? this.dx*0.99 : 0;
    }
    if (this.dy) {
      this.dy = Math.abs(this.dy)>1 ? this.dy*0.99 : 0;
    }
    if (this.speedWarp) {
      this.speedWarp = this.speedWarp>0.1 ? this.speedWarp*0.8 : 0;
    }
    if (this.coll) {
      this.coll--;
    }
  };
}

//structure data
const rs1 = { numSeg: 5, gap: 0.35, radius: 190, speed: -1.4, origin: {x: 350, y: 350}, width: 16, hue: "#DF70FF", name: "S1"};
const rs2 = { numSeg: 12, gap: 0.4, radius: 320, speed: 0.7, origin: {x: 350, y: 350}, width: 12, hue: "#FFD5D0", name: "S2"};
const rs3 = { numSeg: 2, gap: 0.2, radius: 50, speed: 0.5, origin: {x: 350, y: 350}, width: 10, hue: "#86CFEF", name: "S3"};
const rs4 = { numSeg: 18, gap: 0.1, radius: 250, speed: 0.4, origin: {x: 350, y: 350}, width: 12, hue: "#FF6655", name: "S4"};

function rngStruct(seed, scale=1, rstate=false) {
  let rand = seedrandom(seed, {state: rstate})
  // let ox = Math.floor(rng.quick()*350*Math.pow(scale, 0.5));
  return {
    numSeg: Math.floor(1+12*rand.quick())*1,
    arg: 0,
    gap: Math.floor(50*rand.quick())/100,
    speed: ((rand.quick()*1.5)/scale).toFixed(1)-1,
    width: Math.floor((rand.quick()*15+4)*1),
    radius: Math.floor((rand.quick()*280)+30*1),
    hue: shadeColor("#"+((rand.int32().toString(16)).slice(-6)),30),
    glow: Math.floor(20*rand.quick())/15,
    name: seed,
    rngstate: rstate?rand.state:null,
    origin: {x: 350, y: 350},
  }
}

class ringStructure {
  constructor({numSeg=5, gap=0.4, radius=240, speed=5, origin={x: 350, y: 350}, width=10, hue="#E0E0E0", glow=1,name="(Unknown)",arg=0}={}) {
    this.numSeg = numSeg;
    this.arg = arg;
    this.gap = gap;
    this.radius = radius;
    this.speed = speed;
    this.dir = speed<0?-1:1;
    this.origin = origin;
    this.width = width;
    this.hue = hue;
    this.glow = 0.5;
    this.segments = [];
    this.name = name;
  }

  addSegments(openings=0) {
    let arg = this.dir===1?this.arg:this.arg-Math.PI*2;
    let gap = this.gap;
    let numSeg = this.numSeg;
    let r = this.radius;
    let origin = this.origin;
    let width = this.width;
    let hue = this.hue;
    let glow = this.glow;
    let dir = this.dir;
    for (let i=0;i<numSeg;i++) {
      let segment = {
        a: arg,
        b: arg + (Math.PI*2*(1-gap))/numSeg,
        r: r,
        ac: arg%(Math.PI*2),
        bc: (arg + (Math.PI*2*(1-gap))/numSeg)%(Math.PI*2),
        origin: origin,
        width: width,
        hue: i===0?"#FD5E53":hue,
        glow: i===0?glow*3:glow,
        health: 3,
        phase: 0,
      };
      this.segments.push(segment);
      arg += (Math.PI*2)/numSeg;
    }
    for (let i=0;i<openings;i++) {
      this.destroyRandom();
    }
  }

  destroySegment(seg) {
    const destroy = this.segments.filter(item => item !== seg);
    this.segments = destroy;
  }

  destroyRandom() {
    let rand = this.segments[_.random(this.segments.length)-1]
    this.destroySegment(rand);
  }

  moveSegments() {
    for (let seg of this.segments) {

      if (this.speed>0) {
        seg.a += Math.PI*2*0.001*this.speed;
        seg.ac = (Math.abs(seg.a)+Math.PI*2)%(Math.PI*2);
        seg.b += Math.PI*2*0.001*this.speed;
        seg.bc = (Math.abs(seg.b)+Math.PI*2)%(Math.PI*2);
      } else if (this.speed<0) {
        seg.a += Math.PI*2*0.001*this.speed;

        seg.b += Math.PI*2*0.001*this.speed;
        seg.ac = Math.abs(seg.a-Math.PI*2)%(Math.PI*2);
        seg.bc = Math.abs(seg.b-Math.PI*2)%(Math.PI*2);
      }
      let phase = Math.sin((seg.ac+Math.PI*2)%(Math.PI*2));
      let int = Math.floor(Math.abs(phase)*10000)%150;
      seg.glow = this.glow+(Math.floor(Math.abs(phase)*250)*this.glow*0.025)
      // if (int===0) {
      //
      // }
      if (seg.health<3 && int<7/(seg.health+6)) {
        seg.health<0?seg.health+=0.5:seg.health++;
      }
    }
  }
}

//the canvas render is split into a dynamic wrapper and a nested non-updating actual canvas, idea by Phil Nash https://philna.sh/, elements from Reacteroids
class GameCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      zones: [],
    }
    this.saveContext = this.saveContext.bind(this);
    //proton
    this.tick = 1;
    this.psiLevel = 0;
    this.emitterList = [];
  }

  saveContext(canvas) {
    this.protonCanvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = this.ctx.canvas.width;
    this.height = this.ctx.canvas.height;
  }

  componentDidMount() {
    this.createProton();
  }

  createProton() {
    this.proton = new Proton();
    // const imageWidth = 342;
    // const drawScopeWidth = 710;
    // const rect = new Proton.Rectangle((this.protonCanvas.width - imageWidth) / 2, (this.protonCanvas.height - imageWidth) / 2, imageWidth, imageWidth);
    // const rect2 = new Proton.Rectangle((this.protonCanvas.width - drawScopeWidth) / 2, 0, drawScopeWidth, this.protonCanvas.height);
    // const rectZone = new Proton.RectZone(rect2.x, rect2.y, rect2.width, rect2.height);
    // const zones = this.state.zones;
    // this.emitterList[0].addBehaviour(this.customToZoneBehaviour(zones[0], zones[1], zones[2]));

    // this.borderZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
    // this.centerZone = new Proton.RectZone(this.width/2, this.height/2, this.props.world.bodies[0].size);
    // this.centerBehaviour = new Proton.Repulsion(this.centerZone, 10, 30)
    // this.randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    this.clickEmitter = this.createClickEmitter('#F8F8FF', '#F8F8FF', this.props.ball);
    this.renderer = new Proton.CanvasRenderer(this.protonCanvas);
    // this.renderer.onProtonUpdate = function() {
    // TBD
    // };
    this.renderer.onParticleUpdate = (particle) => {
      this.ctx.globalAlpha = 0.9;
      // if (particle.radius>1) {
      //   this.renderer.drawCircle(particle);
      // }
      this.ctx.beginPath();
      this.ctx.strokeStyle = particle.color;
      this.ctx.lineWidth = particle.energy*2+particle.radius/4;
      this.ctx.moveTo(particle.old.p.x-particle.old.a.x*20, particle.old.p.y-particle.old.a.y*20);
      this.ctx.lineTo(particle.p.x, particle.p.y);
      this.ctx.closePath();
      this.ctx.stroke();
      this.ctx.globalAlpha = 1
    };
    this.proton.addRenderer(this.renderer);
  }

  createClickEmitter(color1, color2, target=null) {
    var clickEmitter = new Proton.Emitter();
    // let emitDirection  = Victor(target.x-this.protonCanvas.width/2, target.y-this.protonCanvas.height/2).verticalAngleDeg();
    let centerZone = {
      x: this.props.world.bodies[0].x||this.width/2,
      y: this.props.world.bodies[0].y||this.height/2,
    }
    let centerBehaviour = new Proton.Repulsion(centerZone, 10, this.props.world.bodies[0].size*2||30)
    let borderZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
    let randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    clickEmitter.addBehaviour(randomBehaviour);
    clickEmitter.addBehaviour(borderZoneBehaviour);
    clickEmitter.addBehaviour(centerBehaviour);

    clickEmitter.target = target;
    clickEmitter.damping = 0.012;
    clickEmitter.addInitialize(new Proton.Rate(40,0.025));
    clickEmitter.addInitialize(new Proton.Mass(8));
    clickEmitter.addInitialize(new Proton.Life(new Proton.Span(3,5)))
    clickEmitter.addInitialize(new Proton.Radius(1));
    clickEmitter.currVelocity = new Proton.Velocity(2, new Proton.Span(0,360), 'polar');
    clickEmitter.addInitialize(clickEmitter.currVelocity);
    // if (target.vx && target.vy) {
    //   clickEmitter.addInitialize(new Proton.Force(target.vx*120, target.vy*120))
    // }
    clickEmitter.addBehaviour(new Proton.Color(color1, color2));
    clickEmitter.pointAttraction = new Proton.Attraction(target, 20, 600);
    clickEmitter.addBehaviour(clickEmitter.pointAttraction);
    clickEmitter.p.x = this.props.mouseObj.x;
    clickEmitter.p.y = this.props.mouseObj.y;
    this.proton.addEmitter(clickEmitter);
    return clickEmitter;
  }

  componentDidUpdate() {
    const bodies = this.props.world.bodies;
    if (this.props.tick > this.tick) {
      // this.ctx.save();
      // this.updateWorld();
      if (this.props.tick%10===0) {
        this.updateWorld();
        if (this.props.tick%500===0) {
          this.coreEmitter.emit(this.coreEmitter.e);
        }
      }
      this.proton.update();
      if (this.psiLevel < this.props.resources.psi && this.psiEmitter) {
        this.psiLevel++;
        this.psiEmitter.rate = this.psiLevel < 9 ?
        new Proton.Rate(new Proton.Span(20+this.psiLevel*5, 25+this.psiLevel*8), this.psiLevel*0.25) :
        new Proton.Rate(new Proton.Span(150, 180), 4)
        this.psiEmission();
      }
      this.drawStructures();
      for (let planet of bodies) {
        if (planet) {
          this.drawConnect(planet, this.props.ball);
          this.drawPlanet(planet);
        }
      }
      this.drawBall();
      this.drawScore();
      // this.ctx.restore();
      this.mouseInput()
      this.tick = this.props.tick;
    }
  }

  mouseInput() {
    if (this.props.mousedown === true) {
      //while mouse held down
      if (this.props.mouseTick % 10 === 0) {
        for (let a of this.emitterList) {
          if (a&&a.mouseAttract) {
            a.mouseAttract.reset(this.props.mouseObj, 25, 600);
          }
        }
      }
      this.clickEmission();
    } else {
      if (this.mouseReleased === true) {
        //when mouse released
        for (let a of this.emitterList) {
          if (a&&a.mouseAttract) {
            a.mouseAttract.reset(this.props.mouseObj, 5, 200);
          }
        }
      }
    }
  }

  clickEmission() {
    this.clickEmitter.p.x = this.props.mouseObj.x;
    this.clickEmitter.p.y = this.props.mouseObj.y;
    this.clickEmitter.pointAttraction.reset(this.props.ball, 20, 600)
    // let emitDirection = Victor(-this.props.mouseObj.x+this.props.ball.x, -this.props.mouseObj.y+this.props.ball.y).verticalAngleDeg();
    // console.log(emitDirection)
    // this.clickEmitter.currVelocity.reset(4, new Proton.Span((emitDirection+180)%360-60, (emitDirection+180)%360+60), 'polar');
    this.clickEmitter.emit('once');
  }

  psiEmission() {
    this.psiEmitter.p.x = this.props.ball.x;
    this.psiEmitter.p.y = this.props.ball.y;
    // this.psiEmitter.planetAttraction.reset(this.props.world.bodies[0], 25, 700);
    let emitDirection = Victor(this.props.ball.x-this.protonCanvas.width/2, this.props.ball.y-this.protonCanvas.height/2).verticalAngleDeg();
    this.psiEmitter.currVelocity.reset(new Proton.Span(2,3), new Proton.Span((emitDirection+180)%360-15, (emitDirection+180)%360+15), 'polar');
    this.psiEmitter.emit('once');
  }

  updateWorld() {
    this.updateEmitters();
  }

  updateEmitters(x) {
    const bodies = this.props.world.bodies;
    for (let body of bodies) {
      if (body&&!this.emitterList[body.index]&&body.emitter) {
        this.emitterList[body.index] = body.emitter;
        this.proton.addEmitter(this.emitterList[body.index]);
        this.emitterList[body.index].emit(this.emitterList[body.index].e);
      }
    }

    //rewrite this garbage to get triggered by actual events and not check every damn time
    for (let em of this.emitterList) {
      if (em&&em.target&&!bodies[em.target]) {
        this.proton.removeEmitter(em);
        this.emitterList[em.target] = null;
      }
      else if (em&&em.target&&bodies[em.target]) {
        em.p.x = bodies[em.target].x;
        em.p.y = bodies[em.target].y;
        if (bodies[em.target].coll%6===2) {
          em.emit(em.e);
        }
        if (em.planetAttraction) {
          // em.planetAttraction.reset(bodies[em.target], 15, 500);
          em.planetAttraction.reset(bodies[em.target], em.planetAttraction.force/100, em.planetAttraction.radius);
        }
      }
    }
    if (!this.psiEmitter&&this.props.proton.psiEmitter) {
      this.psiEmitter = this.props.proton.psiEmitter;
      this.proton.addEmitter(this.psiEmitter);
    }
    if (!this.coreEmitter&&this.props.proton.coreEmitter) {
      this.coreEmitter = this.props.proton.coreEmitter;
      this.proton.addEmitter(this.coreEmitter);
    }
  }

  drawConnect(origin, target) {
    this.ctx.beginPath();
    this.ctx.globalAlpha = 0.5
    this.ctx.strokeStyle = '#4397DC';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([40, 15]);
    this.ctx.lineDashOffset = 20
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(target.x, target.y);
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
    this.ctx.setLineDash([])
    this.ctx.globalAlpha = 1
  }

  drawScore() {
    const score = this.props.currentScore;
    this.ctx.fillStyle = "#F5F5F5";
    this.ctx.font = "22px Arial";
    this.ctx.fillText("x" + score, 10, 25);
  }

  drawBall(blur=1.5) {
    const ball = this.props.ball;
    const {x, y, vx, vy, size, color, glow} = ball;
    if (glow) {
      this.ctx.shadowBlur = glow*15;
      this.ctx.shadowColor = shadeColor(color, 10);
    }
    if (blur) {
      this.ctx.beginPath();
      this.ctx.globalAlpha = 0.3;
      this.ctx.arc(x-(vx*blur), y-(vy*blur), size, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.closePath();
      this.ctx.globalAlpha = 1;
    }
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  }

  drawPlanet(p) {
    //outlines the orbit
    this.ctx.beginPath();
    p.orbitX!==p.orbitY ?
    this.ctx.ellipse(p.xPar, p.yPar, p.orbitX, p.orbitY, p.rot/360*(Math.PI*2), 0, Math.PI * 2, true) :
    this.ctx.arc(p.xPar, p.yPar, p.orbitX, 0, Math.PI * 2, false);
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.4;
    this.ctx.strokeStyle = "#E0E0E0";
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
    //the planet itself
    this.ctx.beginPath();
    if (p.glow) {
      this.ctx.shadowBlur = p.glow*10;
      this.ctx.shadowColor = shadeColor(p.hue, 20);
    }
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    this.ctx.fillStyle = p.hue;
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  };

  drawStructures() {
    const structures = this.props.world.structures;
    for (let layer of structures) {
      if (layer) {
        for (let seg of layer.segments) {
          if (seg.health>0) {
          this.drawSegment(seg);
          }
        }
      }
    }
  }

  drawSegment(seg) {
    this.ctx.beginPath();
    if (seg.glow) {
      this.ctx.shadowBlur = seg.glow*3;
      this.ctx.shadowColor = shadeColor(seg.hue, 30);
    }
    this.ctx.globalAlpha = seg.health*0.33;
    this.ctx.arc(seg.origin.x, seg.origin.y, seg.r, seg.a, seg.b, false);
    this.ctx.lineWidth = seg.width;
    this.ctx.strokeStyle = seg.hue;
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  }

  //to try later
  // setZones(img) {
  //   let zones = this.state.zones;
  //   for (let i of img) {
  //     let imagedata = Proton.Util.getImageData(this.ctx, i, rect)
  //     zones.push(new Proton.ImageZone(imagedata, rect.x, rect.y))
  //     }
  //   this.setState((prevState) => {
  //     return {
  //       zones: zones,
  //     }
  //   });
  // }

  // customToZoneBehaviour(zone1, zone2, zone3) {
  //   return {
  //     initialize: function(particle) {
  //       particle.R = Math.random() * 10;
  //       particle.Angle = Math.random() * Math.PI * 2;
  //       particle.speed = Math.random() * (-1.5) + 0.75;
  //       particle.zones = [zone1.getPosition().clone(), zone2.getPosition().clone(), zone3.getPosition().clone()];
  //     },
  //
  //     applyBehaviour: function(particle) {
  //       if (mouseTick % 2 != 0) {
  //         particle.v.clear();
  //         particle.Angle += particle.speed;
  //         let index = (mouseTick % 6 + 1) / 2 - 1;
  //         let x = particle.zones[index].x + particle.R * Math.cos(particle.Angle);
  //         let y = particle.zones[index].y + particle.R * Math.sin(particle.Angle);
  //         particle.p.x += (x - particle.p.x) * 0.05;
  //         particle.p.y += (y - particle.p.y) * 0.05;
  //       }
  //     }
  //   }
  // }

  render() {
    return (
      <PureCanvas width={this.props.screen.width} height={this.props.screen.height} contextRef={this.saveContext} onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove} style={this.props.style}/>
    )
  }
}

class PureCanvas extends React.Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return (
      <canvas id="myCanvas"
      width={this.props.width}
      height={this.props.height}
      ref={node =>
        node ? this.props.contextRef(node) : null
      } onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove} style={this.props.style}
      />
    );
  }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // You can also log the error to an error reporting service
    console.log(error, info);
    this.setState({
      error: error,
      info: info
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
        <h1>Something went wrong.</h1>
        <details style={{ whiteSpace: 'pre-wrap' }}>
        {this.state.error && this.state.error.toString()}
        <br />
        {this.state.info.componentStack}
        </details>
        </div>
      )
    }
    return this.props.children
  }
}

class App extends Component {
  render() {
    return (
      <ErrorBoundary>
      <div className="App">
      <header className="header">
      <h1 className="header-name">
      Orbit game title
      </h1>
      </header>
      <OrbitGame width="700" height="700"/>
      </div>
      </ErrorBoundary>
    );
  }
}

export default App;
// <header className="App-header">
// <img src={logo} className="App-logo" alt="logo" />
// <p style={{ color: `${shadeColor('#CC44EE', 20, 0, -30)}` }}>
// Edit <code>src/App.js</code> and save to reload.
// </p>
// <a
// className="App-link"
// href="https://reactjs.org"
// target="_blank"
// rel="noopener noreferrer"
// >
// Learn React
// </a>
// </header>
