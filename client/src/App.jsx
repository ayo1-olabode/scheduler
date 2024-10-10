import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const MapWithAutocomplete = () => {
  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const [map, setMap] = useState(null);
  const [autocomplete, setAutocomplete] = useState(null);
  const [marker, setMarker] = useState(null);
  const [searchedPlaces, setSearchedPlaces] = useState([]);
  const [addressList, setAddressList] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);  // Store current location
  const [googleMapsLink, setGoogleMapsLink] = useState(""); // Store Google Maps link
  const [debugInfo, setDebugInfo] = useState(""); // State to hold debug information
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;


  useEffect(() => {
    const script = document.createElement('script');
    script.src = googleMapsApiKey
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const initMap = () => {
    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: { lat: 40.749933, lng: -73.98633 },
      zoom: 13,
    });

    setMap(mapInstance);

    const autocompleteInstance = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "name", "place_id", "address_components", "types"],
    });

    setAutocomplete(autocompleteInstance);

    const markerInstance = new window.google.maps.Marker({
      map: mapInstance,
      anchorPoint: new window.google.maps.Point(0, -29),
    });

    setMarker(markerInstance);

    autocompleteInstance.addListener("place_changed", () => handlePlaceChanged(autocompleteInstance, mapInstance, markerInstance));

    // Get current location and add it to the address list
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const currentLocation = { lat: latitude, lng: longitude };

          // Reverse geocode the current location to get the formatted address
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: currentLocation }, (results, status) => {
            if (status === "OK" && results[0]) {
              const geocodeResult = results[0];

              const formattedCurrentLocation = {
                formatted_address: geocodeResult.formatted_address,
                geometry: geocodeResult.geometry,
                place_id: geocodeResult.place_id,
                name: geocodeResult.name || "Current Location",
                html_attributions: geocodeResult.html_attributions || []
              };

              setCurrentLocation(formattedCurrentLocation);

              // Set the map to the current location
              mapInstance.setCenter(currentLocation);
              markerInstance.setPosition(currentLocation);
              markerInstance.setVisible(true);

              // Add the current location to the list
              setSearchedPlaces((prevPlaces) => [formattedCurrentLocation, ...prevPlaces]);
              setAddressList((prevList) => [formattedCurrentLocation, ...prevList]);
            } else {
              console.error("Geocoder failed due to: " + status);
            }
          });
        },
        (error) => {
          console.error("Error retrieving current location: " + error.message);
        }
      );
    }
  };

  const handlePlaceChanged = (autocomplete, map, marker) => {
    marker.setVisible(false);

    const place = autocomplete.getPlace();

    if (!place.geometry || !place.geometry.location) {
      window.alert("No details available for input: '" + place.name + "'");
      return;
    }

    if (place.geometry.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
      map.setZoom(17);
    }

    marker.setPosition(place.geometry.location);
    marker.setVisible(true);

    setSearchedPlaces(prevPlaces => [place, ...prevPlaces]);
    setAddressList(prevList => [place, ...prevList]);

    inputRef.current.value = '';
  };
  
  const handleSubmit = () => {
    axios.post(`${backendUrl}/places`, addressList)
      .then(response => {
        console.log('Data successfully sent to backend:', response.data);
        // Set the googleMapsLink state to the array of URLs
        setGoogleMapsLink(response.data.google_maps_urls);

        // Update the debug info
        setDebugInfo(`Successfully sent addresses to the backend: ${JSON.stringify(addressList)} \nResponse: ${JSON.stringify(response.data)}`);
      })
      .catch(error => {
        console.error('Error sending data to backend:', error);
        // Update the debug info with error message
        setDebugInfo(`Error sending data to backend: ${error.message}`);
      });
  };
  

  return (
    <div style={styles.container}>
      <div style={styles.inputMapContainer}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter a location"
          style={styles.inputField}
        />
        <div ref={mapRef} style={styles.map} />
      </div>
      <div style={styles.infoContainer}>
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead style={styles.thead}>
              <tr>
                <th style={styles.tableHeader}>Formatted Address</th>
              </tr>
            </thead>
            <tbody style={styles.tbody}>
              {searchedPlaces.map((place, index) => (
                <tr key={index}>
                  <td style={styles.tableData}>{place.formatted_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Submit button to send data to the backend */}
        <button onClick={handleSubmit} style={styles.submitButton}>
          Submit Addresses
        </button>

        {/* Display Google Maps links after the response */}
        {googleMapsLink && googleMapsLink.length > 0 && googleMapsLink.map((link, index) => (
          <a
            key={index}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.routeButton}
          >
            View Route on Google Maps
          </a>
        ))}

        {/* Debug Information */}
        <p style={styles.debugParagraph}>
          {debugInfo}
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100vh',
    width: '100vw',
    padding: '0',
    overflow: 'hidden',
  },
  inputMapContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0',
  },
  inputField: {
    width: '100%',
    padding: '10px',
    fontSize: '1.2rem',
    marginBottom: '10px',
    borderRadius: '8px',
    border: '1px solid #ccc',
  },
  map: {
    height: '50vh',
    width: '100%',
    borderRadius: '8px',
  },
  infoContainer: {
    width: '100%',
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  tableContainer: {
    width: '100%',
    marginBottom: '10px',
    maxHeight: '30vh',
    overflowY: 'auto',
    border: '1px solid #ddd',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  thead: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#f2f2f2',
    zIndex: 1,
  },
  tbody: {
    overflowY: 'auto',
  },
  tableHeader: {
    textAlign: 'left',
    padding: '10px',
    backgroundColor: '#f2f2f2',
    borderBottom: '1px solid #ddd',
  },
  tableData: {
    padding: '8px',
    borderBottom: '1px solid #ddd',
  },
  submitButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  routeButton: {
    marginTop: '10px',
    paddingBottom: '10px',
    padding: '12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    textDecoration: 'none',
    textAlign: 'center',
    borderRadius: '8px',
    fontSize: '1.2rem',
    width: '100%',
  },
  body: {
    marginBottom: 10,
    padding: 0,
    fontFamily: 'Arial, sans-serif',
  },
  debugParagraph: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    color: '#333',
    whiteSpace: 'pre-wrap', // To preserve newlines in the debug info
    fontFamily: 'monospace',
    border: '1px solid #ccc',
    borderRadius: '8px',
    width: '100%',
    overflowWrap: 'break-word', // To handle long text
  },
  
};

export default MapWithAutocomplete;
