
const getAPIUrl = () => {
    if (document.location.host.indexOf('metrics.green-coding.org') === 0)
        return "https://api.green-coding.org";
    else
        return "http://api.green-coding.local:8000";
}

const getAnnotations = (my_json) => {
    console.log("my_json from the notes", my_json)

  //   const replicateAnnotations = (target) => {
  //     if (el[2] !== target) { // avoids duplication of annotations on the same chart
  //         if (my_series[target][el[0]] == undefined) {
  //             my_series[target][el[0]] = { name: el[0], data: [{ x: el[1], y: 0 }] }
  //         } else {
  //             my_series[target][el[0]]['data'].push({ x: el[1], y: 0 })
  //         }
  //     }
  // }

  // for (let i = 0; i < my_json.data.length; i++) {
  //     if (my_json.data[i][1] !== "[SYSTEM]") {
  //         annotations.push({
  //             series: my_json.data[i][1],
  //             x: my_json.data[i][3] / 1000,
  //       shortText: my_json.data[i][2][0] === " " ? my_json.data[i][2][1] : my_json.data[i][2][0], // first letter of the message; in case it's a space, then seccond letter
  //       text: my_json.data[i][2],
  //   })
  //     }
  // }
  // hardcoding annotations' timestamps so that they appear on the graph
  //annotations[0].x = 1657294498387.516;
  //annotations[1].x = 1657294500298.983;
  //console.log("annotations", annotations)
}

const fillAvgContainers = (project) => {
    document.querySelector("#project-last-run").innerText = project.last_run;
    document.querySelector("#project-name").innerText = project.name;
    document.querySelector("#project-uri").innerText = project.uri;
    document.querySelector("#project-cpu").innerText = project.cpu;
    document.querySelector("#project-memtotal").innerText = project.memtotal;
  // document.querySelector("#project-idle-time-start").innerText = project.idle_time_start;
  // document.querySelector("#project-idle-time-end").innerText = project.idle_time_end;
  document.querySelector("#project-flow-process-runtime").innerText = project.flow_process_runtime;

}

const getData = (my_json) => {
    const cpu_load = [];
    const mem_load = [];
    const my_series = {}
    let total_energy = null;
    let accumulate = 0;


    my_json.data.forEach(el => {
        /* Spec for data
        el[0] // container_id
        el[1] // time -> in nanoseconds
        el[2] // metric name
        el[3] // value -> This value might need to be rescaled
        '*/

        if (el[0] == '[SYSTEM]' && el[4] == '[START MEASUREMENT]') {
            accumulate = 1;
            return
        } else if (el[0] == '[SYSTEM]' && el[4] == '[END MEASUREMENT]') {
            accumulate = 0;
            return;
        }

        let time_in_ms = el[1] / 1000; // divide nanoseconds timestamp to ms to be handled by charting lib

        let value = null;

        if (el[2] == 'cpu_cgroup') {
            if (accumulate === 1) cpu_load.push(el[3]);
            value = el[3] / 100; // CPU comes as ratio, but since stored as integer is was multiplicated with 100
        } else if (el[2] == 'energy_system_RAPL_MSR') {
            if (accumulate === 1) total_energy += el[3];
            value = el[3];
        } else if (el[2] == 'memory_cgroup') {
            mem_load.push(el[3]);
            value = el[3] / 1000000; // make memory in MB
        } else {
            value = el[3]; // all other metrics we keep in same order of magnitude
        }


        /** Code only for APEX charts **/
        if (my_series[el[2]] == undefined)  my_series[el[2]] = {};

        if (my_series[el[2]][el[0]] == undefined) {
            my_series[el[2]][el[0]] = { name: el[0], data: [{ x: el[1], y: value }] }
        } else {
            my_series[el[2]][el[0]]['data'].push({ x: el[1], y: value })
        }

    })
    return my_series;
}

const displayGraphs = (my_series, style='apex') => {

  let counter = 0; // for automatically creating pair of <div>s

  if(style=='apex') {
    charts = []

    for ( el in my_series) {
        const element = createChartContainer("#chart-container", el, counter)
        const options = {
          chart: {
            type: 'line',
          },
          series: null
        }
        options.series = Object.values(my_series[el])
        charts.push(new ApexCharts(element, options))
    }
    charts.forEach((chart) => chart.render())

  } else {
      for (el in my_series) {
          console.log("el", el)
          console.log(my_series[el])
        if (el !== "null") { // prevents displaying a graph for the container_name "[SYSTEM]" which has all metrics set to "null"
            const { data, labels } = getFormattedDataAndLabels(Object.values(my_series[el]));
        const element = createChartContainer("#chart-container", el, counter)
        const chart = createGraph(el, data, labels, el)
        //chart.setAnnotations(annotations);
        counter++;
        }
      }
  }
}

const getFormattedDataAndLabels = (series) => {
    let containerX;
    let containerY;
    let data = [];
    let labels = ["Time"];

    for (let i = 0; i < series.length; i++) {
        labels.push(series[i].name || "");
        for (let j = 0; j < series[i].data.length; j++) {
            containerX = series[i].data[j].x;
            containerY = series[i].data[j].y;
            data.push(formatData(series.length, i, containerX, containerY));
        }
    }
    console.log(data);
    return { data, labels };
};

const formatData = (totalContainers, currentContainer, X, Y) => {
    let arr = [X];
    for (let i = 0; i < totalContainers; i++) {
        if (i === currentContainer) arr.push(Y);
        else arr.push(NaN);
    }
    return arr;
};

const createChartContainer = (container, el, counter) => {
    const chart_node = document.createElement("div")
    chart_node.classList.add("card");
    chart_node.innerHTML = `<div class="content">
    <div class="description">
    <div class="statistics-chart" id=${el}-chart></div>
    ${counter === 0 ? `<div>
        <label>
        <input type="checkbox" checked="" onchange="toggleNotes()"><span
        id="toggle-notes-spam">Show notes</span>
        </label>
        </div>` : ``}
        </div>
        </div>
        `

    if (counter % 2 === 0) {
        const twoCards = document.createElement("div");
        twoCards.classList.add("ui");
        twoCards.classList.add("two");
        twoCards.classList.add("cards");
        twoCards.classList.add("stackable");
        const id = "#twoCards" + counter;
        twoCards.id = id;
        document.querySelector(container).appendChild(twoCards);
        twoCards.appendChild(chart_node);
    // console.log(`counter ${counter} -> created twoCards div`)
    } else {
        const id = "twoCards" + (counter - 1);
        // console.log(`counter ${counter} -> belongs to already created div with id ${id}`)
        document.querySelector(id).appendChild(chart_node);
    }
    return chart_node.querySelector('.statistics-chart');
}

const createGraph = (element, data, labels, title) => {
  // console.log('labels', labels)
  return new Dygraph(element, data, {
      labels,
      fillGraph: true,
      rollPeriod: 10,
      showRoller: true,
      title,
      legend: "always",
      labelsSeparateLines: true,
      highlightSeriesOpts: { strokeWidth: 2 },
    // showLabelsOnHighlight: false,
    axes: {
        x: {
            axisLabelFormatter: Dygraph.dateAxisLabelFormatter,
            ticker: Dygraph.dateTicker,
        },
    },
    drawCallback: function (g) {
        const notes = document.getElementsByClassName('dygraph-annotation');
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].style.top === "") notes[i].style.display = "none";
        }
    },
    annotationMouseOverHandler: function (ann, point, dg, event) {
        $(ann.div)
        .popup({
            title   : 'Note',
            content : ann.text,
            variation: 'mini',
            inline: true
        }).popup("show")
    },
    annotationMouseOutHandler: function (ann, point, dg, event) {
        $(ann.div)
        .popup("hide")
    },
});
};

const displayStatistics = (cpu_load, total_energy, ) => {
    document.querySelector("#max-cpu-load").innerText = (Math.max.apply(null, cpu_load) / 100) + " %"
    document.querySelector("#total-energy").innerText = (total_energy / 1000).toFixed(2) + " J"
    document.querySelector("#total-co2").innerText = (total_energy / 1000 / 3600000 * 0.519 * 1000000).toFixed(2) + " ugCO2eq"
    document.querySelector("#avg-cpu-load").innerText = ((cpu_load.reduce((a, b) => a + b, 0) / cpu_load.length) / 100).toFixed(2) + " %"

    const total_CO2 = (total_energy / 1000 / 3600000 * 0.519 * 1000000);
  // const total_CO2_in_kg = total_CO2 / 1000000000; // the real value, bring it back later on
  const total_CO2_in_kg = total_CO2; // fake value only so that we see numbers greater than 0.00

  document.querySelector("#trees").innerText = (total_CO2_in_kg / 0.06 / 1000).toFixed(2) + " trees";
  document.querySelector("#miles-driven").innerText = (total_CO2_in_kg / 0.000403 / 1000).toFixed(2) + " miles driven";
  document.querySelector("#gasoline").innerText = (total_CO2_in_kg / 0.008887 / 1000).toFixed(2) + " gallons";
  document.querySelector("#smartphones-charged").innerText = (total_CO2_in_kg / 0.00000822 / 1000).toFixed(2) + " smartphones charged";
  document.querySelector("#flights").innerText = (total_CO2_in_kg / 1000).toFixed(2) + " flights from Berlin to New York City";
}

const toggleNotes = () => {
    const notes = document.getElementsByClassName("dygraph-annotation");
    console.log("notes", notes);
    for (let i = 0; i < notes.length; i++) {
    if (notes[i].style.top !== "") { // prevent the broken notes on top to appear again
        if (notes[i].style.display === "" || notes[i].style.display === "block")
            notes[i].style.display = "none";
        else notes[i].style.display = "block";
    }
}
};


/* Menu toggling */
let openMenu = function(e){
    $(this).removeClass('closed').addClass('opened');
    $(this).find('i').removeClass('right').addClass('left');
    $('#menu').removeClass('collapsed');
    $('#main').removeClass('collapsed');

}
$(document).on('click','#menu-toggle.closed', openMenu);

let closeMenu = function(e){
    $(this).removeClass('opened').addClass('closed');
    $(this).find('i').removeClass('left').addClass('right');
    $('#menu').addClass('collapsed');
    $('#main').addClass('collapsed');
}

$(document).on('click','#menu-toggle.opened', closeMenu);

