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
import particle from './particle.png';

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
}

function towardsBody(origin, target) {
  //makes a vector to follow
  if (origin&&target) {
    let tx = (origin.x - target.x) / objectDistance(origin, target);
    let ty = (origin.y - target.y) / objectDistance(origin, target);
    return { x: tx, y: ty };
  }
}

function getBearing(origin={x:0,y:0}, target={x:0,y:0}) {
  let v= new Victor(target.x-origin.x,target.y-origin.y);
  return (v.horizontalAngle()+Math.PI)
}

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
            {data: solData, parent: 0, index: 0, active: true, status: {
              shield: 0,
              uplink: 0,
              buildings: [],
            }},
            {data: marsData, parent: 0, index: 1, active: true, status: {
              shield: Math.floor(seedrandom("m1".toString()).quick()*70+30),
              uplink: Math.floor(seedrandom("m2".toString()).quick()*70+30),
              buildings: [],
            }},
            {data: venusData, parent: 0, index: 2, active: true, status: {
              shield: Math.floor(seedrandom("v1".toString()).quick()*70+30),
              uplink: Math.floor(seedrandom("v2".toString()).quick()*70+30),
              buildings: [],
            }},
            {data: phobosData, parent: 1, index: 3, active: true, status: {}},
            {data: earthData, parent: 0, index: 4, active: true, status: {
              shield: Math.floor(seedrandom("e1".toString()).quick()*70+30),
              uplink: Math.floor(seedrandom("e2".toString()).quick()*70+30),
              buildings: [],
            }},
            {data: saturnData, parent: 0, index: 5, active: false, status: {
              shield: Math.floor(seedrandom("s1".toString()).quick()*70+30),
              uplink: Math.floor(seedrandom("s2".toString()).quick()*70+30),
              buildings: [],
            }},
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
            {data: rs1, openings: 1, index: 0, active: true, status: {}},
            {data: rs2, openings: 4, index: 1, active: true, status: {}},
            {data: rs3, openings: 0, index: 2, active: true, status: {}},
            {data: rs4, openings: 8, index: 3, active: false, status: {}},
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
        thrustLevel: 0,
        heading: 0,
        power: 0,
        coll: false,
        ct: 0,
        color: "#E0EDFF",
        glow: 1,
      },
      resources: {
        matter: 100,
        energy: 1500,
        psi: 100,
        hm: 0,
      },
      keys: {
        left  : 0,
        right : 0,
        up    : 0,
        down  : 0,
        space : 0,
        released: {
          left  : false,
          right : false,
          up : false,
          down: false,
          space:false
        }
      },
      mousedown: false,
      mouseTick: 0,
      mouseReleased: false,
      mouseObj: {
        x: 350,
        y: 350,
        init: false,
      },
      proton: {

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
    this.psiBlast = 0;
    this.beamBlast = 0;
    this.beamPhase = 0;
    this.handlePlanetBuild = this.handlePlanetBuild.bind(this);
    this.handleSystemChange = this.handleSystemChange.bind(this);
    // this.handleCanvasClick = this.handleCanvasClick.bind(this);
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
    const starTravelList = [...this.state.starList];
    starTravelList.push({name:'Sol',num:6})
    return starTravelList.map(
      (star) =>
      <StarButton onClick={this.handleSystemChange} star={star.name} ui={ui} key={star.name}/>
    )
  }

  makeControlButtons() {
    const pauseButton = this.state.inGame ?
    <Button onClick={this.handlePauseStart} style={{ backgroundColor: 'red' }} text="Pause" key={"Pause"}/> :
    <Button onClick={this.handlePauseStart} text="Continue" key={"Pause"}/>;
    const sparkleButton = <Button onClick={this.handleChargePsi} style={{ backgroundColor: '#4666FF' }} text={`Psi blasts: ${this.state.resources.psi}`} key={"Psi"}/>;
    const chargeButton = <Button onClick={this.handlePowerChange} style={{ backgroundColor: '#E0115F' }} text={`Energy: ${this.state.resources.energy} (click to charge)`} key={"Energy"}/>;
    return [pauseButton, sparkleButton, chargeButton]
  }

  selectOnCanvas(pos) {
    const bodies = [...this.state.world.bodies];
    for (let body of bodies) {
      if (objectDistance(pos, body) < body.size*1.25) {
        // console.log(body.name)
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

  // handleCanvasClick(e) {
  //
  // }

  handleChargePsi() {
    let psi = this.state.resources.psi;
    this.psiBlast += 2;
    return this.setState({ resources: {...this.state.resources, psi: psi-1}});
  }

  handlePlanetBuild(type, e) {
    const bodies = this.state.world.bodies;
    let p = e.target.id;
    let target = bodies.find( b => b.name === p );
    switch (type) {
      case 0: {
        target.status.shield++
        break;
      }
      case 1: {
        target.status.buildings[type] ?
        target.status.buildings[type].lvl++:
        target.status.buildings[type] = {
          name: 'Power grid',
          lvl: 1,
        };
        break;
      }
      case 2: {
        target.status.buildings[type] ?
        target.status.buildings[type].lvl++:
        target.status.buildings[type] = {
          name: 'Ansible',
          lvl: 1,
        };
        break;
      }
      default: {
        console.log("No such building: " + type)
        break;
      }
    };
  }

  handleKeys(value, e) {
    let keys = {...this.state.keys};
    let key_update = false;
    if(e.keyCode === KEY.LEFT   || e.keyCode === KEY.A) {
      keys.released.left = !value&&keys.left
      keys.left  = value?keys.left+1:0
      key_update = key_update||(keys.left||keys.released.left)
    }
    if(e.keyCode === KEY.DOWN   || e.keyCode === KEY.S) {
      keys.released.down = !value&&keys.down
      keys.down  = value?keys.down+1:0
      key_update = key_update||(keys.down||keys.released.down)
    }
    if(e.keyCode === KEY.RIGHT  || e.keyCode === KEY.D) {
      keys.released.right = !value&&keys.right
      keys.right  = value?keys.right+1:0
      key_update = key_update||(keys.right||keys.released.right)
    }
    if(e.keyCode === KEY.UP     || e.keyCode === KEY.W) {
      keys.released.up = !value&&keys.up
      keys.up  = value?keys.up+1:0
      key_update = key_update||(keys.up||keys.released.up)
    }
    if(e.keyCode === KEY.SPACE) {
      keys.released.space = !value&&keys.space
      keys.space  = value?keys.space+1:0
      key_update = key_update||(keys.space||keys.released.space)
    }
    //set state only if differs from current!
    if (key_update) {
      this.setState({ keys: keys });
    }
  }

  mousedownHandler(e) {
    let _x = e.nativeEvent.layerX;
    let _y = e.nativeEvent.layerY;
    this.setState((prevState) => {
      return {
        mousedown: true,
        mouseObj: {
          x: _x,
          y: _y,
        },
      }
    });
    this.selectOnCanvas({x:_x,y:_y});
  }

  beamBlastPower() {
    const beam = this.state.beamBlast;
    if (!beam) {
      if (this.state.mousedown&&this.state.mouseTick===1) {
        //start charge mode
        console.log('start charge mode')
        return this.setState((prevState) => {
          return {
            beamBlast: 1,
            beamPhase: 1
          }
        });
      } else {
        if (this.state.beamPhase) {
          return this.setState({ beamPhase: 0 })
        }
        return
      }
    } else if (beam>0) {
      if (this.state.mouseReleased) {
        //destroy segment/s here

        //switch to blast mode
        console.log('switch to blast mode')
        return this.setState({ beamBlast: beam*-1, beamPhase: 3 })
      }
      else {
        //continue charge mode
        if (beam<50&&this.state.mouseTick%4===0) {
          // console.log(beam)
          return this.setState({ beamBlast: beam+1, beamPhase: 2 })
        }
      }
    } else {
      //continue blast mode
      return this.setState({ beamBlast: beam+1, })
    }
  }

  mouseupHandler(e) {
    return this.setState({ mousedown: false });
  }

  mousemoveHandler(e) {
    if (this.state.mousedown&&this.state.mouseTick%4===0) {
      let _x = e.nativeEvent.layerX;
      let _y = e.nativeEvent.layerY;
      return this.setState({ mouseObj: {x:_x,y:_y} });
    }
  }

  handleOpenModal () {
    return this.setState({ showModal: true });
  }
  handleCloseModal () {
    return this.setState({ showModal: false });
  }
  handleSystemChange(e) {
    let target = e.target.id;
    return this.systemChange(target);
  }
  handlePlanetToggle(e) {
    let p = e.target.id;
    return this.planetToggle(p);
  }
  handleStructureToggle(e) {
    let s = e.target.id;
    return this.structureToggle(s);
  }

  //generating stuff
  async genSysPlanets(name="Alpha Centauri", num=3) {
    const bDatabase = {...this.state.world.bDatabase};
    if (!bDatabase[name]) {
      let system = [];
      let rngData = rngBody(name, "star");
      let star = {
        data: {...rngData}, index: 0, parent: 0, active: false, status:  {
          buildings: [],
        },
      }
      system.push(star);
      for (let i=1;i<num+1;i++) {
        let parent = Math.floor(seedrandom(i.toString()).quick()*(i/num)*4);
        let rngData = rngBody(name+" "+i.toString(), "planet", 1/(parent/2+1));
        //smaller scale for outlying moons
        // console.log(rngData);
        let planet = {
          data: {...rngData}, index: i, parent: parent, active: false, status: {
            shield: Math.floor(seedrandom("s"+i.toString()).quick()*70+30),
            uplink: Math.floor(seedrandom("u"+i.toString()).quick()*70+30),
            buildings: [],
          },
        };
        system.push(planet);
      }
      return system;
    }
    else { return null }
  }

  async genSysStructures(name="Alpha Centauri", num=4) {
    const sDatabase = {...this.state.world.sDatabase};
    if (!sDatabase[name]) {
      let sysStruct = [];
      for (let i=0;i<num;i++) {
        let rngData = rngStruct(name+" "+i.toString());
        let struct = {data: {...rngData}, index: i, openings: 1, active: false};
        sysStruct.push(struct);
      }
      return sysStruct;
    }
    else { return null }
  }

  async createGalaxy(starlist=[{name:"Wolf 359",num:6},{name:"Tau Ceti",num:4},{name:"Groombridge",num:1}]) {
    // console.log(starlist)
    const bDatabase = {...this.state.world.bDatabase};
    const sDatabase = {...this.state.world.sDatabase};
    for (let n of starlist) {
      let system = await this.genSysPlanets(n.name,n.num);
      let sysStruct = await this.genSysStructures(n.name,3);
      bDatabase[n.name] = system;
      sDatabase[n.name] = sysStruct;
    }
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
  }

  async createPrimary(data) {
    const star = new Body(data);
    star.index = 0;
    star.status = {
      shield: 0,
      uplink: 0,
      buildings: [],
    };
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
  createPlanet(data=null,parent=0,index=this.state.world.bodies.length,em=null,status=null) {
    const bodies = [...this.state.world.bodies];
    bodies[index] = new Body(data,bodies[parent]);
    bodies[index].index = index;
    bodies[index].emitter = this.createNewEmitter(em);
    // bodies[index].blastEmitter = this.createBlastEmitter(0,bodies[index].size,1.5,0.1,bodies[index].x,bodies[index].y,null);
    bodies[index].status = status||
    {
      shield: 5,
      uplink: 100,
      buildings: [],
    }
    ;
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
      this.createPlanet(p.data,p.parent,p.index,p.em||null,p.status||null);
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
      let p = ps.pop()
      // console.log(p.data)
      structures[p.index] = new ringStructure(p.data);
      structures[p.index].addSegments(p.openings);
      structures[p.index].index = p.index;
    }
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
    return this.sharedEB
  }

  createNewEmitter({target=null, color1=null, color2=null, mass=5, radius=1, velocity=2.5, rate1=20, rate2=0.5, damp=0.005, e='once', life=5, planetAttraction=true, x=350, y=350, a=0, b=360}={}, special=false) {
    let emitter = new Proton.Emitter();
    emitter.e = e;
    emitter.damping = damp;
    emitter.rate = new Proton.Rate(rate1, rate2);
    emitter.addInitialize(emitter.rate);
    emitter.addInitialize(new Proton.Mass(mass));
    emitter.addInitialize(new Proton.Radius(radius));
    if (life) { emitter.addInitialize(new Proton.Life(life)) }
    emitter.currVelocity = new Proton.Velocity(velocity*1.5, new Proton.Span(a, b), 'polar');
    // emitter.currVelocity = new Proton.Velocity(velocity*1.5, 360, 'polar');
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
    let centerBehaviour = new Proton.Repulsion(this.state.world.bodies[0], 60, this.state.world.bodies[0].size*15)
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
          particle.addBehaviour(new Proton.Color('#59FF98', '#49FF88'))
          particle.mass*=2;
          particle.energy*=2;
          particle.addBehaviour(centerBehaviour)
          this.setState({ resources: {...this.state.resources, matter: this.state.resources.matter+1} });
        }
      }
    }
  }

  //motion stuff
  thrustInput() {
    let tx = 0;
    let ty = 0;
    if (this.state.keys.up) {
      ty -= this.state.ball.thrustAcc*Math.pow(this.state.keys.up, 0.3)*1.5;
    }
    if (this.state.keys.down) {
      ty += this.state.ball.thrustAcc*Math.pow(this.state.keys.down, 0.3)*1.5;
    }
    if (this.state.keys.left) {
      tx -= this.state.ball.thrustAcc*Math.pow(this.state.keys.left, 0.3)*1.5;
    }
    if (this.state.keys.right) {
      tx += this.state.ball.thrustAcc*Math.pow(this.state.keys.right, 0.3)*1.5;
    }
    return [tx, ty]
  }

  borderCollision(object) {
    const bounce = this.state.params.bounceDampening*0.7;
    const width = this.state.screen.width
    const height = this.state.screen.height
    if (object.x+object.vx > width - object.size || object.x+object.vx < object.size) {
      // if (object.x+object.vx<width/-10||object.x+object.vx>width*1.1) {
      //   //return from OOB
      //   console.log('OOB X')
      //   this.setState((prevState) => {
      //     return {
      //       ball: {
      //         ...prevState.ball,
      //         x: (object.x+object.vx)>0?width*Math.sqrt(bounce):width/5*(1+bounce/5),
      //         y: (object.y+object.vy)>0?height*Math.sqrt(bounce):height/5*(1+bounce/5),
      //         vx: prevState.vx*0.05,
      //         vy: prevState.vy*0.05,
      //       }
      //     }
      //   });
      // }
      return [-1, 1]
    }
    if (object.y+object.vy > height - object.size || object.y+object.vy < object.size) {
      // if (object.y+object.vy<height/-10||object.y+object.vy>height*1.1) {
      //   //return from OOB
      //   console.log('OOB Y')
      //   this.setState((prevState) => {
      //     return {
      //       ball: {
      //         ...prevState.ball,
      //         x: (object.x+object.vx)>0?width*Math.sqrt(bounce):width/5*(1+bounce/5),
      //         y: (object.y+object.vy)>0?height*Math.sqrt(bounce):height/5*(1+bounce/5),
      //         vx: prevState.vx*0.05,
      //         vy: prevState.vy*0.05,
      //       }
      //     }
      //   });
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
    return [-gx, -gy]
  }

  structCollisionCheck() {
    let ball = this.state.ball;
    let angle = (Victor(ball.x-this.props.width/2, ball.y-this.props.height/2).horizontalAngle()+Math.PI*2)%(Math.PI*2);
    // let coll = false;
    let structures = [...this.state.world.structures]
    for (let struct of this.state.world.structures) {
      if (struct && objectDistance(ball,struct.origin) > struct.radius-struct.width/2-ball.size && objectDistance(ball,struct.origin) < struct.radius+struct.width/2+ball.size) {
        // let arcLength = (((struct.segments[0].bc-struct.segments[0].ac)*struct.dir+Math.PI*3)%(Math.PI*2)-Math.PI);
        let arcLength = struct.arcLength;
        for (let seg of struct.segments) {
          let angleDiff = struct.speed>0?
          ((angle-seg.ac)+Math.PI*3)%(Math.PI*2)-Math.PI:
          (-(angle+seg.bc)+Math.PI*3)%(Math.PI*2)-Math.PI;
          if (seg.health>0&&((angleDiff>0&&angleDiff<arcLength)||(angleDiff<0&&angleDiff>Math.PI-arcLength))) {
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
          planet.getsPulled(10, this.state.mouseObj, this.state.mouseTick)
        }
      }
      this.setState({ resources: {...this.state.resources, energy: this.state.resources.energy-1} });
    };
    //normal motion
    for (let planet of bodies) {
      if (planet) {
        if (planet.speed!==0&&planet.type!=='star') {
          planet.movePlanet();
        }
        let otherBodies = bodies.filter(item => item !== planet);
        for (let body of otherBodies) {
          if (body) {
            //have to think about handling it better
            if (objectDistance(planet, body)*0.95 < body.size + planet.size) {
              this.planetCollision(planet, body, 2);
            }
          }
        }
      }
    };
  }

  planetCollision(origin, body, type) {
    if (type === 1) {
      const bounce = this.state.params.bounceDampening;
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
      //remake this to only check once
      return this.setState((prevState) => {
        let bodies = [...prevState.world.bodies];
        let b = bodies[bodies.indexOf(body)];
        let o = bodies[bodies.indexOf(origin)];
        if (o.speed) {
          //adds more deviation from the orbit depending on collision tick
          o.dx += towardsBody(origin, body).x*(o.coll*o.size/8)*(b.mass/o.mass);
          o.dy += towardsBody(origin, body).y*(o.coll*o.size/8)*(b.mass/o.mass);
          o.coll += 2;
        }
        // TBD
        // if (b.speed) {
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
    let tl = (t[0]||t[1])?Math.sqrt(Math.pow(Math.abs(t[0]),2)+Math.pow(Math.abs(t[1]),2)):0
    let vx = this.state.ball.vx+g[0]+t[0];
    let vy = this.state.ball.vy+g[1]+t[1];
    let bc = this.borderCollision(ball);
    if (bc[0]!==1||bc[1]!==1) {
      //bounce off borders first
      vx *= -1*bounce*0.5;
      vy *= -1*bounce*0.5;
      let speed = objectDistance(ball, {x: vx, y:vy});
      return this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            x: _.clamp(prevState.ball.x, 0, prevState.screen.width) + vx,
            y: _.clamp(prevState.ball.y, 0, prevState.screen.height) + vy,
            vx: vx,
            vy: vy,
            speed: speed,
            thrustLevel: tl?tl:prevState.ball.thrustLevel?Math.floor(prevState.ball.thrustLevel*100)/101:0,
          }
        }
      })
    }
    else {
      // let sc = [1,1];
      let sc = this.structCollisionCheck();
      let scx = sc[0]===1?0:sc[0]
      let scy = sc[1]===1?0:sc[1]
      // let pc = [1,1];
      let pc = this.ballCheckPlanets();
      let pcx = pc[0]===1?0:pc[0]
      let pcy = pc[1]===1?0:pc[1]
      //this is so messy, have to return 0s for no collision and check if true
      if (scx&&pcx) {
        vx *= -sc[0]*pc[0];
        vy *= -sc[1]*pc[1];
      } else {
        vx *= sc[0]*pc[0];
        vy *= sc[1]*pc[1];
      }
      let speed = objectDistance(ball, {x: vx, y:vy});
      return this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            // will rewrite this completely
            x: prevState.ball.x + vx + (prevState.ball.vx/4)*(scx)+(prevState.ball.vx/4)*(pcx),
            y: prevState.ball.y + vy + (prevState.ball.vy/4)*(scy)+(prevState.ball.vy/4)*(pcy),
            vx: vx,
            vy: vy,
            speed: speed,
            thrustLevel: tl?tl:prevState.ball.thrustLevel?Math.floor(prevState.ball.thrustLevel*100)/101:0,
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
      //tick
      this.setState((prevState) => {
        return {
          ts: t - (delta % animInterval),
          tick: prevState.tick + 1,
          mouseTick: prevState.mousedown ? prevState.mouseTick+1 : 0,
          mouseReleased: !prevState.mousedown&&prevState.mouseTick>0 ? true : false,
          // keysReleased: !prevState.keydown&&prevState.keyTick>0 ? true : false,
        }
      });
      //physics
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
      //graphics
      if (this.state.tick%50===0&&this.state.proton.psiEmitter.particles.length>8) {
        this.emitterParticleCheck(this.state.proton.psiEmitter,this.state.world.bodies[0],4);
      }
      if (this.psiBlast>0) {
        this.psiBlast--;
      }
      if (this.state.mousedown||this.state.beamPhase) {
        this.beamBlastPower();
      }
      //return
      if (this.state.inGame === true) {
        return this.animationID = requestAnimationFrame((t) => {this.update(t)});
      }
    }
    //loop on
    if (this.state.inGame === "loading") {
      console.log("loading")
    }
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
    const starTravelList = this.makeMapInterface(ui);
    const bDatabase = {...this.state.world.bDatabase}
    const planetList = bDatabase[stage]&&bDatabase[stage].length>0?bDatabase[stage].slice(1).map(
      (planet) =>
      <PlanetButton onClick={this.handlePlanetToggle} body={planet} key={planet.data.name}/>
    ):
    null;
    const sDatabase = {...this.state.world.sDatabase}
    const structList = sDatabase[stage]?sDatabase[stage].map(
      (struct) =>
      <StructureButton onClick={this.handleStructureToggle} struct={struct} key={struct.data.name}/>
    ):
    null;
    const selectionInfo = this.state.selectedObj?
    <PlanetInfoBox style={{ color: '#05051A', backgroundColor: '#DACFDA', textAlign:'left', listStyle:'none', padding:'0.4em 0.6em',margin:'0.5em auto',minWidth:'30%',minHeight:"6em"}} obj={this.state.selectedObj} fBuild={this.handlePlanetBuild}/>:
    <span style={{minWidth:'30%',minHeight:"6em",margin:'0.5em auto'}}>{`Click on an in-system body for an info box`}</span>;
    const controlButtons = this.makeControlButtons();
    const canvasCheck = this.state.world.bodies[0]?
    <GameCanvas onMouseDown={this.mousedownHandler} onMouseUp={this.mouseupHandler} onMouseMove={this.mousemoveHandler} style={{ background: "#36454F" }} psiBlast={this.psiBlast} {...this.state} />
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
      {controlButtons}
      </ButtonBlock>
      <ButtonBlock ui={ui}>
      {structList}
      </ButtonBlock>
      <ButtonBlock ui={ui}>
      {planetList}
      </ButtonBlock>
      </Controls>
      <button onClick={this.handleOpenModal} style={{fontSize:'1.3em',alignSelf:'center',backgroundColor: '#30405E', padding:'0.5em',margin:'0.6em auto',borderRadius:'1px'}}>GALAXY MAP</button>
      <img src={particle} alt="" width="32" height="32" />
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
  <div className="interface-element" style={{fontSize:"1.1em",margin:'0.2em auto 0.2em 2em',width:"100%",padding:"0.1em",transitionDuration:'0',display:"block"}}>
  <p style={{textAlign:'left'}}>{`Stage: ${ui.stage} || Score: ${ui.currentScore}`}</p>
  <p style={{textAlign:'left'}}>{`Stable matter: ${ui.resources.matter} || Stable energy: ${ui.resources.energy} || Dark matter: ${ui.resources.matter} || Dark energy: ${ui.resources.energy}`}</p>
  <p style={{textAlign:'left'}}>{`Concentration: ${ui.resources.psi} || Flux: ${ui.currentScore} || Choir: ${ui.resources.psi} || Communion: ${ui.resources.psi}`}</p>
  </div>
);

const PlanetInfoBox = ({ style, obj, fBuild }) => (
  <section style={style}>
  <ul style={{minWidth:"15em"}}>
  <li>{`Name: ${obj.name}`}</li>
  <li>{`Mass: ${obj.mass}`}</li>
  <li>{`Coordinates: X ${obj.x.toFixed(0)}|| Y ${obj.y.toFixed(0)}`}</li>
  <li>{`Type: ${obj.type}`}</li>
  <li>{`Shield power: ${obj?obj.status?obj.status.shield?obj.status.shield:0:0:0}`}</li>
  <li>{`Psychic uplink: ${obj?obj.status?obj.status.uplink?obj.status.uplink:0:0:0}`}</li>
  </ul>
  <span>Buildings:</span>
  {
    (() => {
      const bList = obj.status.buildings.map(
        (b) => (
          <li>{`${b.name}: lvl ${b.lvl}`}</li>
        )
      )
      return (
        <ul style={{minWidth:"5em"}}>
        {bList}
        </ul>
      );
    })()
  }
  <button style={{fontSize: "0.8em",padding:"0.1em",margin:"0.2em"}} onClick={fBuild.bind(this,0)} id={`${obj.name}`}>CHARGE SHIELD</button>
  <button style={{fontSize: "0.8em",padding:"0.1em",margin:"0.2em"}} onClick={fBuild.bind(this,1)} id={`${obj.name}`}>Power grid</button>
  <button style={{fontSize: "0.8em",padding:"0.1em",margin:"0.2em"}} onClick={fBuild.bind(this,2)} id={`${obj.name}`}>Ansible</button>
  <button style={{fontSize: "0.8em",padding:"0.1em",margin:"0.2em"}} onClick={fBuild.bind(this,3)} id={`${obj.name}`}>Choir relay</button>
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
  <button onClick={onClick} type="button" style={ui.stage===star?{backgroundColor: '#DD1133'}:{backgroundColor: '#4422EE'}} id={star} >
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
    this.pullTick = 0;
    console.log("creating body: "+this.name);
    this.rngstate = data.rngstate||0;
  }

  getsPulled(force, target, tick=0) {
    let dist = objectDistance(this, target);
    let fade = 1+(tick*0.05);
    this.speedWarp = (force*200/this.mass)/(Math.pow(dist * 0.5, 1.1)*fade);
    if (dist > this.size*fade)  {
      this.pullTick = tick*10; //for sfx such as beams
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
      //circular orbit motion
      this.x = this.xPar + this.orbitX * Math.cos(this.angle) + this.dx;
      this.y = this.yPar + this.orbitY * Math.sin(this.angle) + this.dy;
    }
    else {
      //elliptical orbit motion
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
    if (this.pullTick) {
      this.pullTick--;
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
    this.regen = 4;
    this.segments = [];
    this.vulnSeg = [];
    this.name = name;
    this.arcLength = (Math.PI*2*(1-gap))/numSeg;
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
    let arcLength = this.arcLength;
    for (let i=0;i<numSeg;i++) {
      let segment = {
        a: arg,
        b: arg + arcLength,
        arcLength: arcLength,
        randArc: _.random(arcLength*0.4,true),
        r: r,
        ac: arg%(Math.PI*2),
        bc: (arg + arcLength)%(Math.PI*2),
        dir: dir,
        origin: origin,
        width: width,
        hue: i===0?"#4DEEE4":hue,
        glow: i===0?glow*5:glow,
        health: 4,
        phase: 0,
        index: i,
        x: null,
        y: null
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
    let phase = Math.floor(Math.abs(Math.sin((this.segments[0].a+Math.PI*2)%(Math.PI*2))*10000));
    let int = phase%150;
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
      // let phase = Math.floor(Math.abs(Math.sin((seg.a+Math.PI*2)%(Math.PI*2))*10000));
      // let int = phase%150;
      seg.glow = this.glow+(phase/300*this.glow)
      // if (int===0) {
      //
      // }
      // if (seg.health<3 && int<this.regen/_.clamp(seg.health+this.regen/2,1,5)) {


      if (seg.health<4 && int<this.regen) {
        seg.health+=seg.health<0?0.5:int<this.regen/2?1:0;
        //experimental: update cartesian coords here
        let tc = Victor(seg.r,0);
        seg.dir>0?tc.rotate(seg.a+(6*seg.arcLength/5)):tc.rotate(seg.b-(6*seg.arcLength/5));
        seg.x = seg.origin.x+tc.x*0.97
        seg.y = seg.origin.y+tc.y*0.97;
        // console.log(seg.x+" "+seg.y);
      }
      if (seg.health<3&&!this.vulnSeg[seg.index]) {
        this.vulnSeg[seg.index] = seg;
        seg.hue = "#EE444D"
      }
      else if (seg.health>3&&this.vulnSeg[seg.index] === seg) {
        this.vulnSeg[seg.index] = null;
        seg.hue = this.hue;
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
    this.saveOverlay = this.saveOverlay.bind(this);
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

  saveOverlay(canvas) {
    this.protonCanvas2 = canvas;
    this.ctx2 = canvas.getContext('experimental-webgl');
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

    this.proton2 = new Proton();
    this.proton2.emitterList = [];
    this.proton2.blastEmitters = [];
    var rend2 = new Proton.WebGLRenderer(this.protonCanvas2);
    rend2.blendFunc("SRC_ALPHA", "ONE");
    this.proton2.addRenderer(rend2);
    // console.log(rend2);
    // this.proton2.addEmitter(this.createOverlayEmitter());
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
    clickEmitter.addInitialize(new Proton.Life(3))
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
        //I forgot what this was going to be
        if (this.psiEmitter && this.props.psiBlast) {
          this.psiLevel++;
          this.psiEmitter.rate = this.psiLevel < 9 ?
          new Proton.Rate(new Proton.Span(20+this.psiLevel*5, 25+this.psiLevel*8), this.psiLevel*0.25) :
          new Proton.Rate(150, 4)
          this.psiEmission();
        }

      }
      this.proton2.update();
      this.proton.update();

      this.drawStructures();
      for (let planet of bodies) {
        if (planet) {
          if (planet.status&&planet.status.uplink) {
            this.drawConnect(planet, this.props.ball);
          }
          this.drawPlanet(planet);
        }
      }
      this.drawBall();
      this.drawScore();
      if (this.props.beamPhase) {
        switch (this.props.beamPhase) {
          case 1: {
            this.drawBeamPower(1);
            break
          }
          case 2: {
            this.drawBeamPower(2);
            break
          }
          case 3: {
            this.drawBeamPower(3);
            break
          }
          default: {
            break
          }
        }
      }
      // else if (this.proton2.emitters.length>0) {
      //   for (let em of this.proton2.emitters) {
      // this.proton2.removeEmitter(em)
      // console.log(this.proton2)
      //   }
      // }
      // this.ctx.restore();
      this.mouseInput()
      this.tick = this.props.tick;
    }
  }

  mouseInput() {
    let mt = this.props.mouseTick;
    if (this.props.mousedown === true) {
      //while mouse held down
      if (mt % 2 === 0) {
        // this.drawBeamPower(2);
        if (mt % 20 === 0) {
          for (let a of this.emitterList) {
            if (a&&a.mouseAttract) {
              a.mouseAttract.reset(this.props.mouseObj, 25, 600);
            }
          }
          this.clickEmission();
        }
      }
      // if (mt===1) {
      //   this.drawBeamPower(1);
      // }
    } else {
      if (this.mouseReleased === true) {
        //when mouse released
        // this.drawBeamPower(3)
        for (let a of this.emitterList) {
          if (a&&a.mouseAttract) {
            a.mouseAttract.reset(this.props.mouseObj, 5, 300);
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
    console.log("psi emit")
    this.psiEmitter.p.x = this.props.ball.x;
    this.psiEmitter.p.y = this.props.ball.y;
    // this.psiEmitter.planetAttraction.reset(this.props.world.bodies[0], 25, 700);
    let emitDirection = Victor(this.props.ball.x-this.protonCanvas.width/2, this.props.ball.y-this.protonCanvas.height/2).verticalAngleDeg();
    this.psiEmitter.currVelocity.reset(4, new Proton.Span((emitDirection+180)%360-15, (emitDirection+180)%360+15), 'polar');
    this.psiEmitter.emit('once');
  }

  updateWorld() {
    if (this.props.mouseTick%5===0) {
      this.updateEmitters();
    }
  }

  updateEmitters() {
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
        if (em.mouseAttract) {
          em.mouseAttract.reset(this.props.mouseObj, 5, 300);
        }
        if (em.planetAttraction) {
          // em.planetAttraction.reset(bodies[em.target], 15, 500);
          em.planetAttraction.reset(bodies[em.target], em.planetAttraction.force/100, em.planetAttraction.radius);
        }
      }
    }
    for (let planet of bodies.slice(1)) {
      //make a beam charge emitter
      if (planet&&!this.proton2.emitterList[planet.index]) {
        this.proton2.emitterList[planet.index] = this.createOverlayEmitter(0,planet.size,1,0.1,planet,this.props.mouseObj)
        this.proton2.addEmitter(this.proton2.emitterList[planet.index])
      }
      //make a different one if star system changes
      else if (planet&&this.proton2.emitterList[planet.index].origin.parent!==planet.parent) {
        this.proton2.emitterList[planet.index].destroy()
        this.proton2.removeEmitter(this.proton2.emitterList[planet.index])
        this.proton2.emitterList[planet.index] = this.createOverlayEmitter(0,planet.size,1,0.1,planet,this.props.mouseObj)
        this.proton2.addEmitter(this.proton2.emitterList[planet.index])
      }
    }
    //if blasting, update target position
    if (this.proton2.blastEmitters.length>0&&this.props.tick%60===0) {
      for (let em of this.proton2.blastEmitters) {
        if (em.particles.length>0) {
        em.blastAttract.reset(em.target, 35, 600)
        // console.log(em)
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
    if (this.props.tick%500===0) {
      this.coreEmitter.emit(this.coreEmitter.e);
    }

  }

  drawConnect(origin, target) {
    this.ctx.beginPath();
    this.ctx.globalAlpha = origin.status.uplink?origin.status.uplink/100:0;
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
    const thrustLevel = Math.floor(ball.thrustLevel*10)
    let power = thrustLevel?shadeColor(color,thrustLevel*6,thrustLevel*-10,thrustLevel*-15):color;
    if (glow) {
      this.ctx.shadowBlur = thrustLevel?glow*10+(Math.pow(thrustLevel*90,0.3)):glow*8;
      this.ctx.shadowColor = power;
    }
    if (blur) {
      this.ctx.beginPath();
      this.ctx.globalAlpha = 0.25;
      this.ctx.arc(x-(vx*blur), y-(vy*blur), size, 0, Math.PI * 2);
      this.ctx.fillStyle = power;
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
    //the planet itself
    this.ctx.beginPath();
    if (p.glow) {
      this.ctx.shadowBlur = p.glow*10;
      this.ctx.shadowColor = shadeColor(p.hue, 20);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    this.ctx.fillStyle = p.hue;
    this.ctx.fill();
    this.ctx.closePath();
    if (p.status&&p.status.shield) {
      // this.ctx.globalAlpha = 0.8;
      this.ctx.shadowBlur = p.status.shield/50;
      this.ctx.shadowColor = "#2045FF";
      this.ctx.globalAlpha = 0.75;
      // this.ctx.globalAlpha = 0.1+p.status.shield/200;
      let sGrad = this.ctx.createLinearGradient(p.x-p.size, p.y-p.size, p.x+p.size, p.y+p.size)
      sGrad.addColorStop(0,"#FFFFFF")
      sGrad.addColorStop(p.status.shield/100,p.hue)
      sGrad.addColorStop(1,p.hue)
      this.ctx.beginPath();

      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = sGrad;
      this.ctx.fill();
      this.ctx.closePath();
    }
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  };

  drawStructures() {
    const structures = this.props.world.structures;
    const bodies = this.props.world.bodies;
    for (let layer of structures) {
      if (layer) {
        for (let seg of layer.segments) {
          if (seg.health>0) {
            this.drawSegment(seg);
            //pass to drawBeamPower here?
            // if (seg.health<3) {
            //   for (let body of bodies.slice(1)) {
            //     this.drawBeam(seg,body)
            //   }
            // }
          }
        }
      }
    }
  }

  drawSegment(seg) {
    this.ctx.beginPath();
    if (seg.glow) {
      this.ctx.shadowBlur = seg.glow*1;
      this.ctx.shadowColor = shadeColor(seg.hue, 20);
    }
    this.ctx.globalAlpha = seg.health*0.25;
    this.ctx.arc(seg.origin.x, seg.origin.y, seg.r, seg.a, seg.b, false);
    this.ctx.lineWidth = seg.width;
    this.ctx.strokeStyle = seg.hue;
    this.ctx.stroke();
    this.ctx.closePath();
    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 0;
  }

  drawBeamPower(phase=1) {
    // let mouseObj = this.props.mouseObj;
    if (phase===1) {
      //begin charge
      const bodies = this.props.world.bodies;
      this.startBeamCharge();
    }
    else if (phase===2) {
      //continue charge
      this.feedBeamCharge();
    }
    else if (phase===3) {
      //unleash charge
      for (let em of this.proton2.emitterList) {
        if (em) {
          em.mouseAttract.reset(this.props.mouseObj, 20, 600);
          em.p.x = em.origin.x;
          em.p.y = em.origin.y;
          em.stop();
        }
      }
      this.drawBeamBlast(this.props.mouseObj)

    }
  }

  startBeamCharge() {
    const planets = this.props.world.bodies.slice(1);
    // const mouseObj = this.props.mouseObj;
    if (this.proton2.blastEmitters.length>0) {
      for (let em of this.proton2.blastEmitters) {
        em.destroy()
        this.proton2.removeEmitter(em)
      }
      this.proton2.blastEmitters = [];
    }

    // if (this.proton2.blastEmitter) {
    //   this.proton2.blastEmitter.destroy()
    //   this.proton2.removeEmitter(this.proton2.blastEmitter)
    //   this.proton2.blastEmitter = null;
    // }
    for (let planet of planets) {
      if (planet && objectDistance(planet,this.props.mouseObj)<300) {
        // if  (!this.proton2.emitters.includes(planet.chargeEmitter)) {
        // if  (!this.proton2.emitterList[planet.index]) {
        //   this.proton2.emitterList[planet.index] = this.createOverlayEmitter(0,planet.size,1,0.1,planet,this.props.mouseObj)
        //   this.proton2.addEmitter(this.proton2.emitterList[planet.index])
        // }
        this.proton2.emitterList[planet.index].mouseAttract.reset(this.props.mouseObj, 20, 600);
        this.proton2.emitterList[planet.index].p.x = planet.x;
        this.proton2.emitterList[planet.index].p.y = planet.y;
        this.proton2.emitterList[planet.index].emit()
        // this.proton2.addEmitter(this.createOverlayEmitter(0,planet.size/10,1,0.05,planet,mouseObj))
      }
    }
  }

  feedBeamCharge() {
    // const mouseObj = this.props.mouseObj;
    for (let em of this.proton2.emitterList) {
      if (em) {
        em.mouseAttract.reset(this.props.mouseObj, 20, 600);
        em.p.x = em.origin.x;
        em.p.y = em.origin.y;
        // em.emit('once');
      }
    }
  }

  drawBeamBlast(o) {
    const structures = this.props.world.structures;
    if (this.proton2.blastEmitters.length<3) {
      let numBlasts = 0;
      for (let layer of structures) {
        if (layer) {
          // for (let seg of layer.segments) {
          for (let seg of layer.vulnSeg) {
            if (seg&&seg.health>0) {
              numBlasts++;
              if (this.proton2.blastEmitters.length<numBlasts) {
                //calculate location
                // let tc = Victor(seg.r,0);
                // seg.dir>0?tc.rotate(seg.a+(6*seg.arcLength/5)):tc.rotate(seg.b-(6*seg.arcLength/5));
                // let target = {x: seg.origin.x+tc.x*0.97, y: seg.origin.y+tc.y*0.97};
                let target = {x: seg.x, y: seg.y};
                console.log(target);

                //draw
                this.proton2.blastEmitters[numBlasts-1] = this.createBlastEmitter(0,40,0.2,1,o,seg,50/this.props.beamBlast);
                this.proton2.addEmitter(this.proton2.blastEmitters[numBlasts-1]);
                this.proton2.blastEmitters[numBlasts-1].emit(Math.abs(this.props.beamBlast/10))
              }
            }
          }
        }
      }
    }

    // if (!this.proton2.blastEmitter) {
    //   this.proton2.blastEmitter = this.createBlastEmitter(0,40,1,0.1,o,t)
    //   this.proton2.addEmitter(this.proton2.blastEmitter)
    //   this.proton2.blastEmitter.emit(Math.abs(this.props.beamBlast/10))
    // }


    // const tick = this.props.tick;
    //
    //
    //
    // let oc = Victor(o.x,o.y)
    // let tc = Victor(t.r,0)
    // t.dir>0?tc.rotate(t.a+(t.arcLength/2)):tc.rotate(t.b-(t.arcLength/2))
    //
    // this.ctx.beginPath();
    // this.ctx.moveTo(o.x, o.y);
    // this.ctx.lineTo(t.origin.x+tc.x*0.97, t.origin.y+tc.y*0.97);
    // this.ctx.closePath();
    // this.ctx.stroke();

  }

  createOverlayEmitter(angle=0,r=40,s1=1,s2=0.1,origin={x:350,y:350},target=null) {
    let emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(4,.03);
    // emitter.rate = new Proton.Rate(5,new Proton.Span(.02,.04));
    emitter.origin = origin;
    emitter.target = target;
    emitter.addInitialize(new Proton.Mass(4));
    emitter.addInitialize(new Proton.Life(1,2));
    emitter.addInitialize(new Proton.Body([particle],32));
    emitter.addInitialize(new Proton.Radius(r));
    emitter.addInitialize(new Proton.V(0.5,angle,'polar'));

    emitter.addBehaviour(new Proton.Alpha(0.5,0.75));
    emitter.addBehaviour(new Proton.Color('#0029FF','#EEEEFF'));
    // emitter.addBehaviour(new Proton.Color('#8F1580','#0029FF'));
    emitter.addBehaviour(new Proton.Scale(s1,s2));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(0,0,700,700),'dead'));
    // emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(this.props.ball.x-10,this.props.ball.y-10,this.props.ball.x+30,this.props.ball.y+30),'dead'));
    emitter.mouseAttract = new Proton.Attraction(target, 15, 600);
    emitter.addBehaviour(emitter.mouseAttract);
    if (origin) {
      emitter.p.x = origin.x;
      emitter.p.y = origin.y;
    }
    else {
      emitter.p.x = 350;
      emitter.p.y = 350;
    }
    // emitter.emit();
    // console.log(this.proton2)
    return(emitter)
  }

  createBlastEmitter(angle=0,r=40,s1=1.5,s2=0.1,origin={x:350,y:350},target=null,rate=.02) {
    let emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(5,new Proton.Span(.01,rate));
    emitter.target = target;
    emitter.addInitialize(new Proton.Mass(6));
    emitter.addInitialize(new Proton.Life(1,2));
    emitter.addInitialize(new Proton.Body([particle],32));
    emitter.addInitialize(new Proton.Radius(r));
    emitter.addInitialize(new Proton.V(0.5,angle,'polar'));
    emitter.addBehaviour(new Proton.Alpha(0.5,0.75));
    emitter.addBehaviour(new Proton.Color('#8F1580','#EEEEFF'));
    emitter.addBehaviour(new Proton.Scale(s1,s2));
    emitter.addBehaviour(new Proton.CrossZone(new Proton.RectZone(0,0,700,700),'bounce'));
    emitter.blastAttract = new Proton.Attraction(target, 35, 600);
    emitter.addBehaviour(emitter.blastAttract);
    if (origin) {
      emitter.p.x = origin.x;
      emitter.p.y = origin.y;
    }
    else {
      emitter.p.x = 350;
      emitter.p.y = 350;
    }

    console.log(emitter)
    return(emitter)

  }

  //to try later; random stuff from the examples gallery for proton.js
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

  //old
  // drawBeam(t, o) {
  //   const tick = this.props.tick;
  //   this.ctx.lineCap = "round";
  //
  //   this.ctx.strokeStyle = '#84CFFA';
  //   this.ctx.lineWidth = 5;
  //   this.ctx.setLineDash([15, 20]);
  //   this.ctx.lineDashOffset = 10+Math.floor((this.props.tick%50)/2)
  //   let oc = Victor(o.x,o.y)
  //   let tc = Victor(t.r,0)
  //   t.dir>0?tc.rotate(t.a+(t.arcLength/2)):tc.rotate(t.b-(t.arcLength/2))
  //
  //
  //   this.ctx.beginPath();
  //   this.ctx.moveTo(o.x, o.y);
  //   this.ctx.lineTo(t.origin.x+tc.x*0.97, t.origin.y+tc.y*0.97);
  //   this.ctx.closePath();
  //   this.ctx.stroke();
  //
  //   tc.rotateBy(t.randArc*t.dir*2)
  //   this.ctx.moveTo(o.x, o.y);
  //   this.ctx.beginPath();
  //   this.ctx.lineTo(t.origin.x+tc.x*0.97, t.origin.y+tc.y*0.97);
  //   this.ctx.closePath();
  //   this.ctx.stroke();
  //
  //   tc.rotateBy(-t.randArc*t.dir*2)
  //   this.ctx.moveTo(o.x, o.y);
  //   this.ctx.beginPath();
  //   this.ctx.lineTo(t.origin.x+tc.x*0.97, t.origin.y+tc.y*0.97);
  //   this.ctx.closePath();
  //   this.ctx.stroke();
  //
  //   this.ctx.lineCap = "butt";
  //   this.ctx.shadowBlur = 0;
  //   this.ctx.shadowColor = 0;
  //   this.ctx.setLineDash([])
  //
  // }

  render() {
    return (
      <PureCanvas width={this.props.screen.width} height={this.props.screen.height} contextRef={this.saveContext} contextRef2={this.saveOverlay} onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove} style={this.props.style}/>
    )
  }
}

class PureCanvas extends React.Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    return (
      <div>
      <canvas id="canvas-overlay"
      width={this.props.width}
      height={this.props.height}
      ref={node =>
        node ? this.props.contextRef2(node) : null
      } onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove}
      />
      <canvas id="myCanvas"
      width={this.props.width}
      height={this.props.height}
      ref={node =>
        node ? this.props.contextRef(node) : null
      } onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove} style={this.props.style}
      />
      </div>
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
      <div className="extra">
      <span>v0.1.0 prototype||</span>
      <a href="https://www.paypal.me/EstherFiddler">Donate</a>
      </div>
      </div>
      </ErrorBoundary>
    );
  }
}

export default App;
