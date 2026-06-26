export const responsive = {
  page(isMobile) {
    return {
      padding: isMobile ? 12 : 20,
    };
  },

  card(isMobile) {
    return {
      background: "#fff",
      borderRadius: 10,
      padding: isMobile ? 14 : 20,
      boxShadow: "0 1px 4px rgba(0,0,0,.06)",
    };
  },

  flexBetween(isMobile) {
    return {
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      justifyContent: "space-between",
      alignItems: isMobile ? "stretch" : "center",
      gap: 12,
    };
  },

  twoColumn(isMobile) {
    return {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
      gap: 20,
      alignItems: "start",
    };
  },

  tableWrapper() {
    return {
      overflowX: "auto",
      width: "100%",
    };
  },
};
