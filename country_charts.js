const width = 300, height = 200, margin = { top: 20, right: 20, bottom: 30, left: 40 };
let data = [], nocMap = {}, athleteMap = {};
const tooltip = d3.select("#tooltip");
const country = decodeURIComponent(new URLSearchParams(window.location.search).get("country"));
const nocsParam = new URLSearchParams(window.location.search).get("nocs");
const selectedNOCs = nocsParam ? nocsParam.split(",").map(d => d.trim().toUpperCase()) : [];

console.log("URL parametri - country:", country);
console.log("URL parametri - selectedNOCs:", selectedNOCs);

d3.select("#countryTitle").text(`${country} 1896 - 2016`);
d3.select("#tabTitle").text(`Detalji - ${country}`);

function resetFilters() {
  d3.select("#yearFilter").property("value", "");
  d3.select("#medalFilter").property("value", "");
  d3.select("#sportFilter").property("value", "");
  d3.select("#filterHint").style("display", "none");
}

d3.select("#resetFilters").on("click", () => {
  resetFilters();
  updateCharts();
});

["#yearFilter", "#medalFilter", "#sportFilter"].forEach(id => {
  d3.select(id).on("change", () => {
    checkFilterHint();
    updateCharts();
  });
});

d3.csv("noc_regions.csv", d => ({ NOC: d.NOC.trim(), region: d.region.trim() })).then(() => {
  Promise.all([
    d3.csv("olympic_medals_detailed.csv"),
    d3.csv("athlete_events.csv")
  ]).then(([medalsRaw, athletesRaw]) => {
    medalsRaw.forEach(d => {
      d.NOC = d.NOC.toUpperCase().trim();
    });

    console.log("URL parametri - country:", country);
    console.log("URL parametri - selectedNOCs:", selectedNOCs);

    const existingNOCs = new Set(medalsRaw.map(d => d.NOC));
    const validSelectedNOCs = selectedNOCs.filter(noc => existingNOCs.has(noc));

    console.log("Validni NOC kodovi:", validSelectedNOCs);

    if (validSelectedNOCs.length === 0) {
      alert("Nema valjanih podataka za ovu državu!");
      return;
    }

    let transformed = [];
    medalsRaw.forEach(d => {
      ["gold", "silver", "bronze"].forEach(medal => {
        const count = +d[medal];
        for (let i = 0; i < count; i++) {
          transformed.push({
            Year: +d.Year,
            NOC: d.NOC,
            Sport: d.Sport,
            Sex: d.Sex,
            Season: d.Season,
            Medal: medal.charAt(0).toUpperCase() + medal.slice(1)
          });
        }
      });
    });

    data = transformed.filter(d => validSelectedNOCs.includes(d.NOC));

    athleteMap = athletesRaw.reduce((acc, d) => {
      if (selectedNOCs.includes(d.NOC) && d.Medal !== "NA") {
        acc.push({
          Year: +d.Year,
          NOC: d.NOC,
          Sport: d.Sport,
          Sex: d.Sex,
          Season: d.Season,
          Medal: d.Medal,
          Age: +d.Age || null,
          Team: d.Team
        });
      }
      return acc;
    }, []);
    console.log("Popunjeno athleteMap:", athleteMap.length);    
    console.log("Broj podataka nakon filtriranja:", data.length);

    const years = [...new Set(data.map(d => d.Year))].sort((a, b) => a - b);
    d3.select("#yearFilter").selectAll("option")
      .data(years).enter().append("option")
      .attr("value", d => d).text(d => d);

    const sports = [...new Set(data.map(d => d.Sport))].sort();
    d3.select("#sportFilter").selectAll("option")
      .data(sports).enter().append("option")
      .attr("value", d => d).text(d => d);

    updateCharts();
  });
});

function checkFilterHint() {
  const filters = ["#yearFilter", "#medalFilter", "#sportFilter"];
  const activeCount = filters.filter(id => d3.select(id).property("value") !== "").length;

  const hintEl = d3.select("#filterHint");
  if (activeCount > 1) {
    hintEl.style("display", "block");
  } else {
    hintEl.style("display", "none");
  }
}

function updateCharts() {
  const year = d3.select("#yearFilter").property("value");
  const medal = d3.select("#medalFilter").property("value");
  const sport = d3.select("#sportFilter").property("value");

  let filtered = data;
  if (year) filtered = filtered.filter(d => d.Year === +year);
  if (medal) filtered = filtered.filter(d => d.Medal === medal);
  if (sport) filtered = filtered.filter(d => d.Sport === sport);

  if (filtered.length === 0) {
    showNoDataMessage();
    return;
  }  

  console.log("Filtrirano podataka:", filtered.length, filtered);


  drawBarChart(filtered);
  drawLineChart(filtered);
  drawPieChart(filtered);
  drawHeatMapChart(filtered);
  drawSeasonChart();
}

function showNoDataMessage() {
  const year = d3.select("#yearFilter").property("value");
  const medal = d3.select("#medalFilter").property("value");
  const sport = d3.select("#sportFilter").property("value");

  const filters = [
    medal ? `medalja: ${medal}` : null,
    sport ? `sport: ${sport}` : null,
    year ? `godina: ${year}` : null
  ].filter(d => d !== null).join(", ");

  const message = `⚠️ Nema podataka za kombinaciju (${filters}).`;

  alert(message);

  // Očisti sve grafove
  ["barChart", "lineChart", "pieChart", "heatMapChart", "seasonChart"].forEach(id => {
    d3.select(`#${id}`).html("");
  });

  tooltip.style("opacity", 0);
}

function drawBarChart(data) {
  const svg = d3.select("#barChart").html("");
  const medals = ["Gold", "Silver", "Bronze"];
  const counts = medals.map(m => data.filter(d => d.Medal === m).length);

  const x = d3.scaleBand().domain(medals).range([margin.left, width - margin.right]).padding(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(counts) || 1]).range([height - margin.bottom, margin.top]);

  svg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`).call(d3.axisBottom(x));
  svg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(y));

  svg.selectAll(".bar")
    .data(counts).enter().append("rect")
    .attr("x", (d, i) => x(medals[i]))
    .attr("y", y(0))
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", (d, i) => ["#FFD700", "#C0C0C0", "#CD7F32"][i])
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`Broj medalja: ${d}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0))
    .transition().duration(800)
    .attr("y", d => y(d))
    .attr("height", d => height - margin.bottom - y(d));
}

function drawLineChart(data) {
  const svg = d3.select("#lineChart").html("");
  const counts = d3.rollup(data, v => v.length, d => d.Sport);
  const top5 = Array.from(counts).sort((a, b) => d3.descending(a[1], b[1])).slice(0, 5);
  const margin = { top: 20, right: 20, bottom: 60, left: 40 };

  const x = d3.scalePoint().domain(top5.map(d => d[0])).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(top5, d => d[1])]).range([height - margin.bottom, margin.top]);

  svg.append("g")
  .attr("transform", `translate(0, ${height - margin.bottom})`)
  .call(d3.axisBottom(x))
  .selectAll("text")
  .each(function(d) {
    const words = d.split(" ");
    d3.select(this).text(null);
    words.forEach((word, i) => {
      d3.select(this)
        .append("tspan")
        .text(word)
        .attr("x", 0)
        .attr("dy", i === 0 ? "0.7em" : "1em")  // malo više prostora dolje
        .attr("text-anchor", "middle");
    });
  })
  .attr("y", 5)                // ⬅️ pomakni tekst prema dolje
  .style("font-size", "11px")
  .style("fill", "#444");



  svg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(y));

  svg.append("path")
    .datum(top5)
    .attr("fill", "none")
    .attr("stroke", "#00bcd4")
    .attr("stroke-width", 2)
    .attr("d", d3.line().x(d => x(d[0])).y(d => y(d[1])));

  svg.selectAll("circle")
    .data(top5)
    .enter().append("circle")
    .attr("cx", d => x(d[0]))
    .attr("cy", d => y(d[1]))
    .attr("r", 0)
    .attr("fill", "#0086c3")
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`${d[0]}: ${d[1]} medalja`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0))
    .transition().duration(800)
    .attr("r", 5);

}

function drawPieChart(data) {
  const container = d3.select("#pieChart").html("");
  const svg = container.append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const counts = d3.rollup(data, v => v.length, d => d.Sex === "F" ? "Žene" : "Muškarci");
  const pie = d3.pie().value(d => d[1])(Array.from(counts));
  const arc = d3.arc().innerRadius(0).outerRadius(Math.min(width, height) / 2 - margin.left);
  const colors = { "Muškarci": "#00d2ff", "Žene": "#0086c3" };

  svg.selectAll("path")
    .data(pie).enter().append("path")
    .attr("d", arc)
    .attr("fill", d => colors[d.data[0]])
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`${d.data[0]}: ${d.data[1]}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", event => tooltip
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Dodaj legendu
  container.append("foreignObject")
    .attr("x", 0)
    .attr("y", height - 30)
    .attr("width", width)
    .attr("height", 30)
    .html(`
      <div style="display: flex; justify-content: center; gap: 20px; font-size: 13px;">
        <div><span style="display:inline-block;width:12px;height:12px;background:#00d2ff;margin-right:5px;border-radius:2px;"></span> Muškarci</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#0086c3;margin-right:5px;border-radius:2px;"></span> Žene</div>
      </div>
    `);
}

function drawHeatMapChart(data) {
  const svg = d3.select("#heatMapChart").html("");
  const counts = d3.rollup(data, v => v.length, d => d.Year);
  const entries = Array.from(counts, ([year, count]) => ({ year, count }));

  const x = d3.scaleBand().domain(entries.map(d => d.year)).range([margin.left, width - margin.right]).padding(0.05);
  const y = d3.scaleLinear().domain([0, d3.max(entries, d => d.count)]).range([height - margin.bottom, margin.top]);
  const color = d3.scaleSequential(d3.interpolateOranges).domain([0, d3.max(entries, d => d.count)]);

  svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => i % 2 === 0)))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-0.8em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-45)");

  svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).ticks(4));

  svg.selectAll("rect")
    .data(entries)
    .enter().append("rect")
    .attr("x", d => x(d.year))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d.count))
    .attr("height", d => height - margin.bottom - y(d.count))
    .attr("fill", d => color(d.count))
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`${d.year}: ${d.count} medalja`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0));
}

function drawSeasonChart() {
  const svg = d3.select("#seasonChart").html("");

  // Dohvati filtere
  const year = d3.select("#yearFilter").property("value");
  const medal = d3.select("#medalFilter").property("value");
  const sport = d3.select("#sportFilter").property("value");

  // Filtriraj iz athleteMap (jer tamo je Season)
  let filtered = athleteMap;
  if (year) filtered = filtered.filter(d => d.Year === +year);
  if (medal) filtered = filtered.filter(d => d.Medal === medal);
  if (sport) filtered = filtered.filter(d => d.Sport === sport);

  const seasons = ["Summer", "Winter"];
  const counts = d3.rollup(filtered, v => v.length, d => d.Season);
  const entries = seasons.map(season => [season, counts.get(season) || 0]);
  console.log("Medalje po sezoni:", entries);

  const x = d3.scaleBand().domain(seasons).range([margin.left, width - margin.right]).padding(0.2);
  const maxY = d3.max(entries, d => d[1]) || 1;
  const y = d3.scaleLinear().domain([0, maxY]).range([height - margin.bottom, margin.top]);


  svg.append("g").attr("transform", `translate(0, ${height - margin.bottom})`).call(d3.axisBottom(x));
  svg.append("g").attr("transform", `translate(${margin.left}, 0)`).call(d3.axisLeft(y));

  svg.selectAll("rect")
    .data(entries).enter().append("rect")
    .attr("x", d => x(d[0]))
    .attr("y", y(0))
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", "#fb8c00")
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`${d[0]}: ${d[1]} medalja`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px"))
    .on("mouseout", () => tooltip.style("opacity", 0))
    .transition().duration(800)
    .attr("y", d => y(d[1]))
    .attr("height", d => height - margin.bottom - y(d[1]));
}
