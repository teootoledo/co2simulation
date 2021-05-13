import React, { useState, useEffect } from "react";

const RoomContext = React.createContext();

export function RoomProvider(props) {
  // Efectividad de las mascarillas
  // NO: 0
  // TELA: 0.5
  // QUIRURGICO: 0.65
  // N95: 0.9

  // Tasa de exhalación por minuto
  // ALUMNO: 0.24636
  // PROFESOR: 0.36812

  // Renovaciones de aire por hora
  // CERRADA: 0.1
  // PARCIAL: 3
  // ABIERTA: 5
  // SISTEMA: 7

  // Medidas de la habitación
  // ALTO: 2.4
  // ANCHO: 6
  // LARGO: 10

  // Propiedades del ambiente
  const [room, setRoom] = useState({
    teachers: 1,
    people: 12,
    infecteds: 1,
    maskEfficiency: 0, // 0 | 0.5 | 0.65 | 0.9
    maskPopulation: 1, // Fracción de personas con máscara. Asumimos un 100%
    duration: 1,
    ventilation: 0.1, // Renovaciones de aire por hora: 7 | 5 | 3 | 0.1
    firstOrderLoss: 5.92, // ventilation + 0.92 // ? Averiguar esto
    totalCO2ExhaladoPMinuto: 3.32444, // teachers * 0.36812 + people * 0.24636
    totalCO2ExhaladoPSegundo: 0.05540733333, // anterior pero en litros por segundo
    totalCO2Ambiente: 3366,
    roomHeight: 2.4,
    roomWidth: 6,
    roomLarge: 10,
    roomVolumeM3: 144, // Volumen en metros cúbicos
    co2Exterior: 415, // Calibración exterior
    infectedExhalation: 60, // Tasa de exhalación sentado y hablando fuerte
    netEmissionRate: 60, // Tasa de emisión neta
    avrConcentrationOfQuantas: 0.06800508279, // Concentración media de quantas
    InhaledQuantasByPerson: 0.8551079345, // Quantas inhaladas por persona
    infectionProbability: 57.47,
  });

  // ============================ FUNCIONES PARA REALIZACIÓN DE CÁLCULOS ======================

  function updateAvrConcentrationOfQuantasVENT(ventRate) {
    const { netEmissionRate, roomVolumeM3, duration } = room;
    const NEWfirstOrderLoss = ventRate + 0.92; // ? Averiguar si esto está bien

    const avrConcentrationOfQuantas =
      (netEmissionRate / NEWfirstOrderLoss / roomVolumeM3) *
      (1 -
        (1 / NEWfirstOrderLoss / duration) *
          (1 - Math.exp(-NEWfirstOrderLoss * duration)));

    setRoom({
      ...room,
      ventilation: ventRate,
      avrConcentrationOfQuantas: avrConcentrationOfQuantas,
      firstOrderLoss: NEWfirstOrderLoss,
    });
    updateInhaledQuantasByPerson(avrConcentrationOfQuantas);
    updateTotalCO2AmbienteVENT(ventRate);
  }

  // FUNCIONES PARA ACTUALIZAR LA CONCENTRACIÓN MEDIA DE QUANTAS //////////////////
  // Actualización gral.
  function updateAvrConcentrationOfQuantasNER(newNER) {
    const { roomVolumeM3, firstOrderLoss, duration } = room;
    const newACQ =
      (newNER / firstOrderLoss / roomVolumeM3) *
      (1 -
        (1 / firstOrderLoss / duration) *
          (1 - Math.exp(-firstOrderLoss * duration)));

    setRoom({
      ...room,
      avrConcentrationOfQuantas: newACQ,
    });
    updateInhaledQuantasByPerson(newACQ);
  }

  // Actualización por cambio de duración
  function updateAvrConcentrationOfQuantasDURATION(newDuration) {
    const { netEmissionRate, roomVolumeM3, firstOrderLoss } = room;

    const avrConcentrationOfQuantas =
      (netEmissionRate / firstOrderLoss / roomVolumeM3) *
      (1 -
        (1 / firstOrderLoss / newDuration) *
          (1 - Math.exp(-firstOrderLoss * newDuration)));

    updateInhaledQuantasByPerson(avrConcentrationOfQuantas, newDuration);
    updateTotalCO2AmbienteDURATION(newDuration);
  }

  // Actualización por cambio de máscara
  function updateNetEmissionRateMASK(newMask) {
    const { infectedExhalation, maskPopulation, infecteds } = room;

    const netEmissionRate =
      infectedExhalation * (1 - newMask * maskPopulation) * infecteds;
    setRoom({
      ...room,
      netEmissionRate: netEmissionRate,
      maskEfficiency: newMask,
    });

    updateAvrConcentrationOfQuantasNER(netEmissionRate);
  }

  // FUNCIONES PARA CALCULAR QUANTAS INHALADAS POR PERSONA ///////////////////////
  // Actualización por cambio de ACQ
  function updateInhaledQuantasByPerson(newACQ, newDuration) {
    const { duration, maskEfficiency, maskPopulation } = room;

    if (newDuration) {
      const newInhaledQuantasByPerson =
        newACQ * 0.52 * newDuration * (1 - maskEfficiency * maskPopulation);

      const totalCO2 = updateTotalCO2AmbienteDURATION(newDuration);

      setRoom({
        ...room,
        InhaledQuantasByPerson: newInhaledQuantasByPerson,
        duration: newDuration,
        avrConcentrationOfQuantas: newACQ,
        totalCO2Ambiente: totalCO2,
      });
    } else {
      const newInhaledQuantasByPerson =
        newACQ * 0.52 * duration * (1 - maskEfficiency * maskPopulation);
      setRoom({
        ...room,
        InhaledQuantasByPerson: newInhaledQuantasByPerson,
        avrConcentrationOfQuantas: newACQ,
      });
    }
  }

  // FUNCIONES PARA CALCULAR PROBABILIDAD DE INFECCIÓN POR PERSONA ///////////////
  // Probabilidad de infección
  function updateInfectionProbability() {
    const { InhaledQuantasByPerson } = room;

    const infectionProbability = (1 - Math.exp(-InhaledQuantasByPerson)) * 100;

    setRoom({ ...room, infectionProbability: infectionProbability });
  }

  // FUNCIONES PARA ACTUALIZAR TOTAL CO2 EN AMBIENTE /////////////////////////////
  // Actualización por cambio de ventilacion
  function updateTotalCO2AmbienteVENT(ventRate) {
    const { totalCO2ExhaladoPSegundo, roomVolumeM3, duration, co2Exterior } =
      room;

    const totalCO2 =
      ((totalCO2ExhaladoPSegundo * 3.6) / ventRate / roomVolumeM3) *
        (1 - (1 / ventRate / duration) * (1 - Math.exp(-ventRate * duration))) *
        1000000 +
      co2Exterior;

    setRoom({ ...room, totalCO2Ambiente: totalCO2 });
  }

  // Actualización por cambio de duracion
  function updateTotalCO2AmbienteDURATION(newDuration) {
    const { totalCO2ExhaladoPSegundo, roomVolumeM3, ventilation, co2Exterior } =
      room;

    return (
      ((totalCO2ExhaladoPSegundo * 3.6) / ventilation / roomVolumeM3) *
        (1 -
          (1 / ventilation / newDuration) *
            (1 - Math.exp(-ventilation * newDuration))) *
        1000000 +
      co2Exterior
    );
  }

  // ================================== RETORNO DEL OBJETO ===================================
  // Valor de retorno
  const value = {
    room,
    setRoom,
    updateAvrConcentrationOfQuantasNER,
    updateAvrConcentrationOfQuantasVENT,
    updateAvrConcentrationOfQuantasDURATION,
    updateNetEmissionRateMASK,
    updateInhaledQuantasByPerson,
  };

  useEffect(() => {
    console.log(room.totalCO2Ambiente);
  });

  return <RoomContext.Provider value={value} {...props} />;
}

export function useRoom() {
  const context = React.useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom debe estar dentro del proveedor RoomContext");
  }
  return context;
}
