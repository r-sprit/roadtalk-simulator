// types: 0="car", 1="truck", 2="obstacle" (including red traffic lights)
// id's defined mainly in vehicle.js and vehicleDepot.js
// id<100:              special vehicles/road objects
// id=1:                ego vehicle
// id=10,11, ..49       disturbed vehicles 
// id=50..99            depot vehicles/obstacles (vehicle.isDepotObstacle())
// id=100..199          traffic lights (vehicle.isTrafficLight())
// id>=200:             normal vehicles and obstacles
// id>=200&&type!=="obstacle" regular vehicles (vehicle.isRegularVeh)



function vehicle(length, width, u, lane, speed, type){
    this.length=length; // car length[m]
    this.width=width;   // car width[m]
    this.u=u;           // long coordinate=arc length [m]
    this.lane=lane;     // integer-valued lane 0=leftmost
    this.v=lane;        // lane coordinate (lateral, units of lane width), not speed!!
    this.dvdt=0;     // vehicle angle to road axis (for drawing purposes)
    this.laneOld=lane;  // for logging and drawing vontinuous lat coords v
    this.speed=speed;
    this.type=type;
    this.id=Math.floor(100000*Math.random()+200); // ids 0-199 special purpose
    //console.log("vehicle cstr: this.id=",this.id);

    this.route=[]; // route=sequence of road IDs (optional)
    this.divergeAhead=false; // if true, the next diverge can/must be used
    this.toRight=false; // set strong urge to toRight,!toRight IF divergeAhead


    this.dt_lastLC=10;
    this.dt_lastPassiveLC=10;
    this.acc=0;
    this.iLead=-100;
    this.iLag=-100;
    //this.iLeadOld=-100; // necessary for update local environm after change
    //this.iLagOld=-100; // necessary for update local environm after change

    this.iLeadRight=-100;
    this.iLeadLeft=-100;
    this.iLagRight=-100;
    this.iLagLeft=-100;
    //this.iLeadRightOld=-100;
    //this.iLeadLeftOld=-100;
    //this.iLagRightOld=-100;
    //this.iLagLeftOld=-100;

    // just start values
    this.longModel=new ACC(20,1.3,2,1,2);//IDM_v0,IDM_T,IDM_s0,IDM_a,IDM_b);
    this.LCModel=new MOBIL(4,0.2,0.3); //MOBIL_bSafe, MOBIL_bThr, MOBIL_bBiasRight);


    this.yCenterPix = 0;
    this.xCenterPix = 0;
}



//######################################################################
// implement route info (not yet used?)
//######################################################################

vehicle.prototype.setRoute=function(route){
  this.route=route;
}



//######################################################################
// check if vehicle vehObject is a traffic light
//######################################################################

vehicle.prototype.isTrafficLight=function(){
    return (this.id>=100)&&(this.id<200);
} 

//######################################################################
// check if vehicle vehObject is a depot vehicle but no traffic light
//######################################################################

vehicle.prototype.isDepotObstacle=function(){
    return (this.id>=50)&&(this.id<100);
} 

//######################################################################
// check if vehicle vehObject has been externally perturbed (slowed down)
//######################################################################

vehicle.prototype.isPerturbed=function(){
    return (this.id>=10)&&(this.id<50);
} 


//######################################################################
// check if vehicle vehObject is a special object (depot veh or traffic light)
//######################################################################

vehicle.prototype.isSpecialVeh=function(){
    return (this.id>=50)&&(this.id<200);
} 

//######################################################################
// check if vehicle vehObject is a regular vehicle (car or truck)
//######################################################################

vehicle.prototype.isRegularVeh=function(){
    return (this.isPerturbed()||(this.id>=200))&&(this.type !== "obstacle");
} 

