import React, { Component } from 'react';
// import TweenMax from "gsap/TweenMax";
import _ from 'lodash';
import Proton from 'proton-js';
import Victor from 'victor';
import './App.css';

//global constants
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
  if (b1&&b2) {
    return Math.sqrt(Math.pow(b1.x-b2.x, 2) + Math.pow(b1.y-b2.y, 2));
  }
}

function towardsBody(origin, target) {
  //makes a vector to follow
  if (origin&&target) {
    let tx = (origin.x - target.x) / objectDistance(origin, target);
    let ty = (origin.y - target.y) / objectDistance(origin, target);
    return { x: tx, y: ty };
  }
}

function getBearing(originX, originY, targetX, targetY) {
  return -Math.atan2(targetY-originY, targetX-originX) *360/(Math.PI*2);
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
      world: {
        stage: null,
        bodies: [],
        pendingBodies: [{data: venusData, parent: 0, index: 2, active: true},{data: marsData, parent: 0, index: 1, active: true},{data: phobosData, parent: 1, index: 3, active: true},{data: earthData, parent: 0, index: 4, active: true}],
        bDatabase: {
          Venus: {data: venusData, parent: 0, index: 2, active: true},
          Mars: {data: marsData, parent: 0, index: 1, active: true},
          Phobos: {data: phobosData, parent: 1, index: 3, active: true},
          Earth: {data: earthData, parent: 0, index: 4, active: true},
          Saturn: {data: saturnData, parent: 0, index: 5, active: false},
        },
        structures: [],
        pendingStructures: [{data: rs1, openings: 2, index: 0, active: true},{data: rs2, openings: 4, index: 1,  active: true},{data: rs3, openings: 0, index: 2, active: true}],
        sDatabase: {
          S1: {data: rs1, openings: 2, index: 0, active: true},
          S2: {data: rs2, openings: 4, index: 1, active: true},
          S3: {data: rs3, openings: 0, index: 2, active: true},
          S4: {data: rs4, openings: 8, index: 3, active: false},
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
      tick: 0,
      ts: 0,
      randomHash: 0,
      currentScore: 0,
      inGame: true,
    };
    this.animationID = null;
    this.timerID = null;
    this.handlePowerChange = this.handlePowerChange.bind(this);
    this.increasePsi = this.increasePsi.bind(this);
    this.handlePlanetToggle = this.handlePlanetToggle.bind(this);
    this.handleStructureToggle = this.handleStructureToggle.bind(this);
    this.handlePauseStart=this.handlePauseStart.bind(this);
    this.handleKeys=this.handleKeys.bind(this);
    this.mouseupHandler = this.mouseupHandler.bind(this);
    this.mousedownHandler = this.mousedownHandler.bind(this);
    this.mousemoveHandler = this.mousemoveHandler.bind(this);

    const sol = new Body(solData);
    sol.index = 0;
    this.state.world.bodies.push(sol);
  }

  createPlanet(data=null,parent=0,index=this.state.world.bodies.length,em=null) {
    const bodies = [...this.state.world.bodies];
    // console.log(data);
    bodies[index] = new Body(data,bodies[parent]);
    bodies[index].index = index;
    bodies[index].emitter = this.createNewEmitter(em);
    console.log(bodies[index]);
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
        p.em = { target: p.index, e: 300, color1: shadeColor(p.data.hue,40), rate1: 6, rate2: 1.5, velocity: 2, damp: 0.006, life: 5, mass: 4 };
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

  handlePlanetToggle(e) {
    let p = e.target.id
    // console.log(this.state.world.bDatabase);
    let target = {...this.state.world.bDatabase[p]};
    if (!target.active&&this.state.world.bodies[target.parent]) {
      const pending = [...this.state.world.pendingBodies];
      pending.push(target);
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            pendingBodies: pending,
            bDatabase: {
              ...prevState.world.bDatabase,
              [p]: {
                ...prevState.world.bDatabase[p],
                active: true,
              }
            }
          }
        }
      });
    } else if (target.active) {
      const bodies = [...this.state.world.bodies];
      const db = {...this.state.world.bDatabase};
      //disables any active children
      for (let body of bodies) {
        if (body&&body.parent===bodies[target.index]) {
          console.log(body)
          let name = body.name;
          db[name].active = false;
          bodies[bodies.indexOf(body)] = null;
        }
      }
      bodies[target.index] = null;
      db[p].active = false;
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            bodies: bodies,
            bDatabase: db,
          }
        }
      });
    }
  }

  createStructure(data=null,openings=0,index=this.state.world.structures.length) {
    const structures = [...this.state.world.structures];
    structures[index] = new ringStructure(data);
    structures[index].addSegments(openings);
    structures[index].index = index;
    // console.log(structures[index]);
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
    for (let i=0;i<ps.length;i++) {
      let p = ps.splice(0,1)[0];
      this.createStructure(p.data,p.openings,p.index);
    }
    this.setState((prevState) => {
      return {
        world: {
          ...prevState.world,
          pendingStructures: ps,
        }
      }
    });
  }

  handleStructureToggle(e) {
    let s = e.target.id;
    let target = {...this.state.world.sDatabase[s]};
    // console.log(this.state.world.sDatabase[s]);
    if (!target.active) {
      const pending = [...this.state.world.pendingStructures];
      pending.push(target);
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            pendingStructures: pending,
            sDatabase: {
              ...prevState.world.sDatabase,
              [s]: {
                ...prevState.world.sDatabase[s],
                active: true,
              }
            }
          }
        }
      });
    } else if (target.active) {
      const structures = [...this.state.world.structures];
      structures[target.index] = null;
      this.setState((prevState) => {
        return {
          world: {
            ...prevState.world,
            structures: structures,
            sDatabase: {
              ...prevState.world.sDatabase,
              [s]: {
                ...prevState.world.sDatabase[s],
                active: false,
              }
            }
          }
        }
      });
    }
  }

  createNewEmitter({target=false, color1=null, color2=null, mass=5, radius=1, velocity=2.5, rate1=20, rate2=0.5, damp=0.005, e='once', life=5, planetAttraction=true, x=350, y=350, a=0, b=360}={}) {
    var emitter = new Proton.Emitter();
    emitter.target = target;
    emitter.damping = damp;
    emitter.rate = new Proton.Rate(new Proton.Span(rate1, rate1*1.5), rate2);
    emitter.addInitialize(emitter.rate);
    emitter.addInitialize(new Proton.Mass(mass));
    emitter.addInitialize(new Proton.Radius(radius));
    if (life) { emitter.addInitialize(new Proton.Life(life)) }
    emitter.currVelocity = new Proton.Velocity(new Proton.Span(velocity, velocity*1.5), new Proton.Span(a, b), 'polar');
    emitter.addInitialize(emitter.currVelocity);
    color1 ?
    emitter.addBehaviour(new Proton.Color(color1, color2||color1)) :
    emitter.addBehaviour(new Proton.Color('random'));
    let borderZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.state.width, this.state.height), 'bound');
    let centerZone = new Proton.RectZone(this.state.width/2, this.state.height/2, this.state.world.bodies[0].size);
    let randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    emitter.addBehaviour(randomBehaviour);
    emitter.addBehaviour(borderZoneBehaviour);
    if (planetAttraction) {
      emitter.planetAttraction = new Proton.Attraction(this.state.world.bodies[0], 10, 500);
      emitter.addBehaviour(emitter.planetAttraction);
    }
    let centerBehaviour = new Proton.Repulsion(centerZone, 30, 40)
    emitter.addBehaviour(centerBehaviour);
    if (target) {
      //proper initialization TBD
      emitter.mouseAttract = new Proton.Attraction(this.state.mouseObj, 5, 200);
      emitter.addBehaviour(emitter.mouseAttract);
      emitter.p.x = this.state.width/2;
      emitter.p.y = this.state.height/2;
    };
    if (!target) {
      emitter.p.x = x;
      emitter.p.y = y;
    };
    emitter.e = e;
    console.log(emitter);
    return emitter;
  }

  makePsiEmitter() {
    this.setState((prevState) => {
      return {
        proton: {
          ...prevState.proton,
          psiEmitter: this.createNewEmitter({ e: 'once', color1: '#6699FF', color2: '#FFDDFF', rate1: 50, rate2: 0.01, velocity: 1, mass: 8, radius: 1, damp: 0.009, life: (1,5) }),
        }
      }
    });
  }

  addCoreEmitter() {
    this.setState((prevState) => {
      return {
        proton: {
          ...prevState.proton,
          coreEmitter: this.createNewEmitter({ e: 3, color1: shadeColor(this.state.world.bodies[0].hue,30,-10,-10), rate1: 6, rate2: 0.5, velocity: 2, damp: 0.015, life: 20, mass: 15, radius: 1.5, planetAttraction: true, a:_.random(0,180), b:_.random(181,360) }),
        }
      }
    });
  }

  planetCollision(origin, body, type) {
    if (objectDistance(origin, body)*0.9 < body.size + origin.size) {
      if (type === 1) {
        this.setState((prevState) => {
          return {
            currentScore: prevState.currentScore + 1,
            ball: {
              ...prevState.ball,
              x: prevState.ball.x-(prevState.ball.vx * this.state.params.bounceDampening * 0.5),
              y: prevState.ball.y-(prevState.ball.vy * this.state.params.bounceDampening * 0.5),
              vx: -prevState.ball.vx * this.state.params.bounceDampening,
              vy: -prevState.ball.vy * this.state.params.bounceDampening,
            }
          }
        });
      }
      if (type === 2) {
        this.setState((prevState) => {
          let newBodies = [...prevState.world.bodies];
          let b = newBodies[newBodies.indexOf(body)];
          let o = newBodies[newBodies.indexOf(origin)];
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
            bodies: newBodies,
          }
        });
      }
    }
  }

  borderCollision(object) {
    if (object.x+object.vx > this.state.screen.width - object.size || object.x+object.vx < object.size) {
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vx: -prevState.ball.vx * prevState.params.bounceDampening,
          }
        }
      });
    }
    if (object.y+object.vy > this.state.screen.width - object.size || object.y+object.vy < object.size) {
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vy: -prevState.ball.vy * prevState.params.bounceDampening,
          }
        }
      });
    }
  }

  gravBall(object, targets) {
    var gx = 0;
    var gy = 0;
    for (let body of targets) {
      if (body) {
        let dist = objectDistance(object, body);
        gx += body.mass*towardsBody(object, body).x/Math.pow(dist * this.state.params.gravFalloff, 2);
        gy += body.mass*towardsBody(object, body).y/Math.pow(dist * this.state.params.gravFalloff, 2);
      }
    }
    this.setState((prevState) => {
      return {
        ball: {
          ...prevState.ball,
          vx: prevState.ball.vx - gx,
          vy: prevState.ball.vy - gy,
        }
      }
    })
  }

  thrustInput() {
    var tx = 0;
    var ty = 0;
    if (this.state.keys.up) {
      ty -= this.state.ball.thrustAcc;
    }
    if (this.state.keys.down) {
      ty += this.state.ball.thrustAcc;
    }
    if (this.state.keys.left) {
      tx -= this.state.ball.thrustAcc;
    }
    if (this.state.keys.right) {
      tx += this.state.ball.thrustAcc;
    }
    if (tx||ty) {
      this.setState((prevState) => {
        return {
          ball: {
            ...prevState.ball,
            vx: prevState.ball.vx + tx,
            vy: prevState.ball.vy + ty,
          }
        }
      })
    }
  }

  structureCollision() {
    let ball = this.state.ball;
    let angle = (Victor(ball.x-this.props.width/2, ball.y-this.props.height/2).horizontalAngle()+Math.PI*3)%(Math.PI*2)+Math.PI;
    let coll = false;
    //todo: fix for counterclockwise speeds
    for (let struct of this.state.world.structures) {
      if (struct&&objectDistance(ball,struct.origin) > struct.radius-struct.width/2-ball.size && objectDistance(ball,struct.origin) < struct.radius+struct.width/2+ball.size) {
        let arcLength = ((struct.segments[0].bc-struct.segments[0].ac)*(struct.speed>0?1:-1)+Math.PI*3)%(Math.PI*2)-Math.PI;
        for (let seg of struct.segments) {
          let angleDiff = (angle-(struct.speed>0?seg.ac:seg.bc)+Math.PI*3)%(Math.PI*2)-Math.PI;
          if (seg.health>0&&((angleDiff>0&&angleDiff<arcLength)||(angleDiff<0&&angleDiff>Math.PI-arcLength))) {
            // console.log(struct);
            // console.log(angleDiff);
            // console.log(arcLength);
            seg.health--;
            coll = struct.index;
            return this.collState(coll);
          }
        }
      }
    }
    return this.collState(coll);
  }

  collState(coll) {
    this.setState((prevState) => {
      if (coll!==false&&this.state.ball.coll===false) {
        return {
          ball: {
            ...prevState.ball,
            vx: -prevState.ball.vx * prevState.params.bounceDampening,
            vy: -prevState.ball.vy * prevState.params.bounceDampening,
            coll: coll,
            ct: 1,
          }
        }
      } else if (coll!==false&&this.state.ball.coll!==false) {
        return {
          ball: {
            ...prevState.ball,
            vx: prevState.ball.vx*(1+(prevState.ball.ct/10)),
            vy: prevState.ball.vy*(1+(prevState.ball.ct/10)),
            ct: prevState.ball.ct+1,
          }
        }
      } else {
        return {
          ball: {
            ...prevState.ball,
            coll: false,
            ct: 0,
          },
        }
        //"NO COLLISION! Fake News!" - Donald J. Trump
      }
    });
  }

  planetMotion() {
    const bodies = this.state.world.bodies;
    //apply a pulling force, costs energy
    if (this.state.mousedown && this.state.resources.energy > 0 && this.state.mouseTick%1===0) {
      for (let planet of bodies) {
        if (planet) {
          planet.getsPulled(12, this.state.mouseObj, this.state.mouseTick)
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
        let otherBodies = bodies.filter(item => item !== planet);
        for (let body of otherBodies) {
          if (body) { this.planetCollision(planet, body, 2) }
        }
        if (planet.orbitX) {
          planet.movePlanet();
        }
      }
    };
  }

  moveBall() {
    const ball = this.state.ball;
    const bodies = this.state.world.bodies;
    this.borderCollision(ball);
    this.gravBall(ball, bodies);
    for (let body of bodies) {
      if (body) { this.planetCollision(ball, body, 1) }
    }
    this.structureCollision();
    this.thrustInput();
    const speed = objectDistance(ball, {x: ball.vx, y:ball.vy});
    this.setState((prevState) => {
      return {
        ball: {
          ...prevState.ball,
          x: prevState.ball.x + prevState.ball.vx,
          y: prevState.ball.y + prevState.ball.vy,
          speed: speed,
        }
      }
    })
  }

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

  increasePsi() {
    this.setState((prevState) => {
      return {
        resources: {
          ...prevState.resources,
          psi: prevState.resources.psi+1,
        },
      }
    });
  }

  handleKeys(value, e) {
    let keys = this.state.keys;
    if(e.keyCode === KEY.LEFT   || e.keyCode === KEY.A) { keys.left  = value }
    if(e.keyCode === KEY.DOWN   || e.keyCode === KEY.S) { keys.down  = value }
    if(e.keyCode === KEY.RIGHT  || e.keyCode === KEY.D) { keys.right = value }
    if(e.keyCode === KEY.UP     || e.keyCode === KEY.W) { keys.up    = value }
    if(e.keyCode === KEY.SPACE) keys.space = value;
    this.setState((prevState) => {
      return { keys: keys }
    });
  }

  mousedownHandler(e) {
    this.setState((prevState) => {
      return {
        mousedown: true,
      }
    });
    this.mousemoveHandler(e);
  }

  mouseupHandler(e) {
    this.setState((prevState) => {
      return { mousedown: false }
    });
  }

  mousemoveHandler(e) {
    // if (this.state.mousedown||!this.state.mouseObj.init) {
    if (this.state.mousedown) {
      // console.log(e.nativeEvent.layerX)
      // console.log(e.nativeEvent.layerY)
      var _x = e.nativeEvent.layerX;
      var _y = e.nativeEvent.layerY;
      this.setState((prevState) => {
        return {
          mouseObj: {
            x: _x,
            y: _y,
          },
        }
      });
    }
  }

  handlePauseStart() {
    if (this.state.inGame === false) {
      this.continueGame();
      console.log("continue");
    } else {
      this.stopGame();
      console.log("pause");
    }
  }

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

  componentDidMount() {
    window.addEventListener('keyup',   this.handleKeys.bind(this, false));
    window.addEventListener('keydown', this.handleKeys.bind(this, true));
    // window.addEventListener('resize',  this.handleResize.bind(this, false));
    this.makePsiEmitter();
    this.addCoreEmitter();
    this.continueGame();
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.animationID);
  }

  update(t) {
    // const bodies = this.state.world.bodies;
    const structures = this.state.world.structures;
    //fps
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
      for (let layer of structures) {
        if (layer) {
          layer.moveSegments();
        }
      }
      this.moveBall();
    }
    if (this.state.inGame) {
      this.animationID = requestAnimationFrame((t) => {this.update(t)});
    }
  }

  render() {
    // const readyCanvas = this.state.world.bodies.length > 0 ?
    // <GameCanvas onMouseDown={this.mousedownHandler} onMouseUp={this.mouseupHandler} onMouseMove={this.mousemoveHandler} {...this.state} /> :
    // null;
    //interface elements
    const ui = {
      tick: this.state.tick,
      ts: this.state.ts,
      inGame: this.state.inGame,
      currentScore: this.state.currentScore,
      ball: this.state.ball,
      resources: this.state.resources,
      mousedown: this.mousedown,
    }
    const bodies = this.state.world.bDatabase;
    const structures = this.state.world.sDatabase;
    const pauseButton = this.state.inGame ?
    <Button onClick={this.handlePauseStart} style={{ backgroundColor: 'red' }} text="Pause" /> :
    <Button onClick={this.handlePauseStart} text="Continue" />;
    const sparkleButton = <Button onClick={this.increasePsi} style={{ backgroundColor: '#4666FF' }} text={`Psi blasts: ${this.state.resources.psi}`} />;
    const chargeButton = <Button onClick={this.handlePowerChange} style={{ backgroundColor: '#E0115F' }} text={`Energy: ${this.state.resources.energy} (click to charge)`} />;

    return (
      <div className="showcase">
      <GameCanvas onMouseDown={this.mousedownHandler} onMouseUp={this.mouseupHandler} onMouseMove={this.mousemoveHandler} {...this.state} />
      <GUIWrap ui={ui}>
      <StatsDisplay ui={ui} />
      <p>WASD to accelerate</p>
      <ButtonBlock ui={ui}>
      {pauseButton}{sparkleButton}{chargeButton}
      </ButtonBlock>
      <ButtonBlock ui={ui}>
      <PlanetButton onClick={this.handlePlanetToggle} body={bodies.Earth}/>
      <PlanetButton onClick={this.handlePlanetToggle} body={bodies.Venus}/>
      <PlanetButton onClick={this.handlePlanetToggle} body={bodies.Saturn}/>
      <PlanetButton onClick={this.handlePlanetToggle} body={bodies.Mars}/>
      <PlanetButton onClick={this.handlePlanetToggle} body={bodies.Phobos}/>
      </ButtonBlock>
      <ButtonBlock ui={ui}>
      <StructureButton onClick={this.handleStructureToggle} struct={structures.S1} />
      <StructureButton onClick={this.handleStructureToggle} struct={structures.S2} />
      <StructureButton onClick={this.handleStructureToggle} struct={structures.S3} />
      <StructureButton onClick={this.handleStructureToggle} struct={structures.S4} />
      </ButtonBlock>
      </GUIWrap>
      </div>
    );
  }
};

//interface
const GUIWrap = ({ ui, children }) => (
  <div className="game-interface">
  {children}
  </div>
);
const StatsDisplay = ({ ui }) => (
  <div className="interface-element">
  <p>{`Energy: ${ui.resources.energy} || Matter: ${ui.resources.matter} || Psi: ${ui.resources.psi} || Score: ${ui.currentScore}`}</p>
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
const PlanetButton = ({onClick, body}) => (
  <button onClick={onClick} style={{backgroundColor: `${shadeColor(body.data.hue,-20)}`}} id={body.data.name}>Toggle planet: {body.data.name}</button>
)
const StructureButton = ({onClick, struct}) => (
  <button onClick={onClick} style={{backgroundColor: `${shadeColor(struct.data.hue,-40)}`}} id={struct.data.name}>Toggle structure: {struct.data.name}</button>
)

//planet data
const marsData = {
  size: 9,
  orbitX: 190,
  orbitY: 150,
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
  orbitX: 33,
  orbitY: 31,
  rot: 100,
  speed: 1.5,
  mass: 50,
  hue: "#EE1111",
  glow: 0.6,
  angle: 30,
  name: "Phobos",
}

const venusData = {
  size: 12,
  orbitX: 70,
  orbitY: 65,
  rot: 250,
  speed: 1,
  mass: 165,
  hue: "#00A86B",
  glow: 0.8,
  angle: 0,
  name: "Venus",
}

const earthData = {
  size: 11,
  orbitX: 145,
  orbitY: 130,
  rot: 330,
  speed: 1,
  mass: 150,
  hue: "#007FFF",
  glow: 1.2,
  angle: 120,
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

class Body {
  constructor(data, parent=null) {
    this.data = data;
    this.parent = parent;
    this.xPar = this.parent ? this.parent.x : data.xPar||350;
    this.yPar = this.parent ? this.parent.y : data.yPar||350;
    this.size = data.size||15;
    this.orbitX = data.orbitX||0;
    this.orbitY = data.orbitY||this.orbitX;
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
const rs1 = { numSeg: 6, gap: 0.25, radius: 190, speed: 0.4, origin: {x: 350, y: 350}, width: 16, hue: "#DF70FF", name: "S1"};
const rs2 = { numSeg: 12, gap: 0.4, radius: 320, speed: 0.7, origin: {x: 350, y: 350}, width: 12, hue: "#FFD5D0", name: "S2"};
const rs3 = { numSeg: 2, gap: 0.2, radius: 50, speed: 0.5, origin: {x: 350, y: 350}, width: 10, hue: "#86CFEF", name: "S3"};
const rs4 = { numSeg: 18, gap: 0.1, radius: 250, speed: 0.4, origin: {x: 350, y: 350}, width: 12, hue: "#FF6655", name: "S4"};

class ringStructure {
  constructor({numSeg=5, arg=0, gap=0.4, radius=240, speed=5, origin={x: 350, y: 350}, width=10, hue="#E0E0E0", glow=1,name="(Unknown)"}={}) {
    this.numSeg = numSeg;
    this.arg = arg;
    this.gap = gap;
    this.radius = radius;
    this.speed = speed;
    this.origin = origin;
    this.width = width;
    this.hue = hue;
    this.glow = glow;
    this.segments = [];
    this.name = name;
  }

  addSegments(openings=0) {
    let arg = this.arg;
    let gap = this.gap;
    let numSeg = this.numSeg;
    let r = this.radius;
    let origin = this.origin;
    let width = this.width;
    let hue = this.hue;
    let glow = this.glow;
    for (let i=0;i<numSeg;i++) {
      let segment = {
        a: arg,
        b: arg + (Math.PI*2*(1-gap))/numSeg,
        r: r,
        ac: arg%(Math.PI*2),
        bc: (arg + (Math.PI*2*(1-gap))/numSeg)%(Math.PI*2),
        origin: origin,
        width: width,
        hue: hue,
        glow: glow,
        health: 3,
      };
      this.segments.push(segment);
      arg += (Math.PI*2)/numSeg;
    }
    // console.log(this.segments);
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
      seg.a += Math.PI*2*0.001*this.speed;
      seg.ac = (Math.abs(seg.a)+Math.PI*2)%(Math.PI*2);
      seg.b += Math.PI*2*0.001*this.speed;
      seg.bc = (Math.abs(seg.b)+Math.PI*2)%(Math.PI*2);
      if (seg.health<3 && seg.ac%(Math.PI*2*0.1)<0.01) {
        seg.health++;
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
    this.protonCanvas = canvas;;
    this.ctx = canvas.getContext('2d');
    this.width = this.ctx.canvas.width;
    this.height = this.ctx.canvas.height;
  }

  componentDidMount() {
    this.createProton();
    console.log(this.props);
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
    this.borderZoneBehaviour = new Proton.CrossZone(new Proton.RectZone(0, 0, this.protonCanvas.width, this.protonCanvas.height), 'bound');
    this.centerZone = new Proton.RectZone(this.width/2, this.height/2, this.props.world.bodies[0].size);
    this.centerBehaviour = new Proton.Repulsion(this.centerZone, 10, 30)
    this.randomBehaviour = new Proton.RandomDrift(5, 5, .05);
    this.clickEmitter = this.createClickEmitter('#FF6FFF', '#FD1212', this.props.ball);
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
      this.ctx.moveTo(particle.old.p.x-particle.old.a.x*15, particle.old.p.y-particle.old.a.y*15);
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
    clickEmitter.target = target;
    clickEmitter.damping = 0.005;
    clickEmitter.addInitialize(new Proton.Rate(50));
    clickEmitter.addInitialize(new Proton.Mass(5));
    clickEmitter.addInitialize(new Proton.Life(new Proton.Span(4,6)))
    clickEmitter.addInitialize(new Proton.Radius(1));
    clickEmitter.currVelocity = new Proton.Velocity(3, new Proton.Span(0,360), 'polar');
    clickEmitter.addInitialize(clickEmitter.currVelocity);
    // if (target.vx && target.vy) {
    //   clickEmitter.addInitialize(new Proton.Force(target.vx*120, target.vy*120))
    // }
    clickEmitter.addBehaviour(new Proton.Color(color1, color2));
    clickEmitter.addBehaviour(this.randomBehaviour);
    clickEmitter.addBehaviour(this.borderZoneBehaviour);
    clickEmitter.addBehaviour(this.centerBehaviour);
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
      this.updateWorld();
      this.proton.update();
      if (this.psiLevel < this.props.resources.psi && this.psiEmitter) {
        this.psiLevel++;
        this.psiEmitter.rate = this.psiLevel < 9 ?
        new Proton.Rate(new Proton.Span(20+this.psiLevel*5, 25+this.psiLevel*8), this.psiLevel*0.25) :
        new Proton.Rate(new Proton.Span(150, 180), 4)
        this.psiEmission();
      }
      if (this.props.tick%500===0) {
        this.coreEmitter.emit(this.coreEmitter.e);
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
    this.psiEmitter.planetAttraction.reset(this.props.world.bodies[0], 25, 700);
    let emitDirection = Victor(this.props.ball.x-this.protonCanvas.width/2, this.props.ball.y-this.protonCanvas.height/2).verticalAngleDeg();
    this.psiEmitter.currVelocity.reset(new Proton.Span(2,3), new Proton.Span((emitDirection+180)%360-15, (emitDirection+180)%360+15), 'polar');
    this.psiEmitter.emit('once');
    // console.log(this.psiEmitter)
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
        // console.log(this.emitterList)
      }
    }
    for (let em of this.emitterList) {
      if (em&&em.target&&!bodies[em.target]) {
        // console.log(em)
        this.proton.removeEmitter(em);
        this.emitterList[em.target] = null;
      }
      if (em&&em.target&&bodies[em.target]) {
        em.p.x = bodies[em.target].x;
        em.p.y = bodies[em.target].y;
        if (bodies[em.target].coll%5===2) {
          em.emit('once');
        }
        if (em.planetAttraction) {
          em.planetAttraction.reset(bodies[em.target], 15, 500);
        }
      }
    }
    if (!this.psiEmitter&&this.props.proton.psiEmitter) {
      this.psiEmitter = this.props.proton.psiEmitter;
      this.proton.addEmitter(this.psiEmitter);
      // console.log(this.psiEmitter);
    }
    if (!this.coreEmitter&&this.props.proton.coreEmitter) {
      this.coreEmitter = this.props.proton.coreEmitter;
      this.proton.addEmitter(this.coreEmitter);
      // console.log(this.coreEmitter);
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
          this.drawSegment(seg);
        }
      }
    }
  }

  drawSegment(seg) {
    this.ctx.beginPath();
    if (seg.glow) {
      this.ctx.shadowBlur = seg.glow*10;
      this.ctx.shadowColor = shadeColor(seg.hue, 10);
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
      <PureCanvas width={this.props.screen.width} height={this.props.screen.height} contextRef={this.saveContext} onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove}/>
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
      } onMouseDown={this.props.onMouseDown} onMouseUp={this.props.onMouseUp} onMouseMove={this.props.onMouseMove} style={{ background: "#36454F" }}
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
