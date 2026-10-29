/* Keep the playoff bracket in the same home area as the 82-game calendar tiles. */
(function () {
  "use strict";
  let calendarView = null;
  let homeHeading = null;
  let homeDescription = null;
  let seasonBadge = null;
  let originalHeading = "";
  let originalDescription = "";
  let originalBadge = "";

  const $ = id => document.getElementById(id);
  function cacheHome() {
    const home = $("mynbaHomeSchedule");
    const title = document.querySelector("#mynbaHome .mynba-home-title h2");
    const desc = document.querySelector("#mynbaHome .mynba-home-title p");
    homeHeading = title || homeHeading;
    homeDescription = desc || homeDescription;
    seasonBadge = $("mynbaSeasonBadge") || seasonBadge;
    if (homeHeading && !originalHeading) originalHeading = homeHeading.textContent;
    if (homeDescription && !originalDescription) originalDescription = homeDescription.textContent;
    if (seasonBadge && !originalBadge) originalBadge = seasonBadge.textContent;
    if (!calendarView) calendarView = $("seasonCalendarView");
    return home;
  }
  function showPlayoffsAtCalendar() {
    const home = cacheHome();
    const section = $("playoffsSection");
    if (!section) return false;
    section.hidden = false;
    if (home) {
      if (!calendarView) calendarView = $("seasonCalendarView");
      if (calendarView && calendarView.parentElement !== home && !calendarView.isConnected) {
        // The calendar may already have been moved into another view by the MyNBA navigation.
        const stored = $("seasonCalendarView");
        if (stored) calendarView = stored;
      }
      // Never detach seasonCalendarView from the document: renderSeasonCalendar()
      // still updates it on every playoff simulation, even while it is hidden.
      if (calendarView) calendarView.hidden = true;
      if (section.parentElement !== home) home.appendChild(section);
      if (homeHeading) homeHeading.textContent = "Playoffs NBA";
      if (homeDescription) homeDescription.textContent = "Le tableau des séries remplace maintenant les tuiles de la saison régulière. Clique sur un match pour le simuler, puis ouvre son box score.";
      if (seasonBadge) seasonBadge.textContent = "PLAYOFFS";
    } else {
      // Fallback for the classic layout, where the calendar and playoffs are in the same section.
      const calendar = $("seasonCalendarView");
      if (calendar && calendar.parentElement && section.parentElement !== calendar.parentElement) {
        calendarView = calendar;
        calendar.hidden = true;
        calendar.parentElement.appendChild(section);
      }
    }
    const season = $("seasonSection");
    if (season) season.hidden = true;
    section.hidden = false;
    if (typeof window.renderPlayoffs === "function") window.renderPlayoffs();
    return true;
  }
  function restoreCalendar() {
    const home = cacheHome();
    const section = $("playoffsSection");
    const calendar = calendarView || $("seasonCalendarView");
    if (home && calendar && section && section.parentElement === home) {
      section.hidden = true;
      calendar.hidden = false;
      if (homeHeading) homeHeading.textContent = originalHeading || "Calendrier de la saison";
      if (homeDescription) homeDescription.textContent = originalDescription || "Choisis une équipe et clique sur une tuile pour simuler sa prochaine rencontre.";
      if (seasonBadge) seasonBadge.textContent = originalBadge || "Saison NBA";
      const season = $("seasonSection");
      if (season) season.hidden = false;
    } else if (calendar) {
      calendar.hidden = false;
      if (section) section.hidden = true;
    }
  }
  function install() {
    cacheHome();
    window.NBAMyNBAShowPlayoffs = showPlayoffsAtCalendar;
    const initPlayoffs = window.initializePlayoffs;
    if (typeof initPlayoffs === "function" && !initPlayoffs.__homePlayoffsWrapped) {
      const wrapped = function () {
        const result = initPlayoffs.apply(this, arguments);
        if (typeof phase === "undefined" || phase === "playoffs" || typeof playoffs !== "undefined" && playoffs) {
          Promise.resolve().then(showPlayoffsAtCalendar);
        }
        return result;
      };
      wrapped.__homePlayoffsWrapped = true;
      window.initializePlayoffs = wrapped;
    }
    const initSeason = window.initializeSeasonCalendar;
    if (typeof initSeason === "function" && !initSeason.__homeCalendarWrapped) {
      const wrapped = function () {
        const result = initSeason.apply(this, arguments);
        if (result !== false) restoreCalendar();
        return result;
      };
      wrapped.__homeCalendarWrapped = true;
      window.initializeSeasonCalendar = wrapped;
    }
    document.addEventListener("click", event => {
      if (event.target.closest('[data-team-tab="playoffs"]')) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof window.NBAMyNBAPreparePlayoffs === "function") window.NBAMyNBAPreparePlayoffs();
        showPlayoffsAtCalendar();
      }
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();