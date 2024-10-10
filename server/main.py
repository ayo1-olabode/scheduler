from pydantic import BaseModel
from fastapi import FastAPI
from typing import List, Optional
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware
import json

load_dotenv()  

app = FastAPI()

origins = os.getenv("CORS_ALLOWED_ORIGINS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the Pydantic models to match the structure of your data
class Viewport(BaseModel):
    south: float
    west: float
    north: float
    east: float

class Geometry(BaseModel):
    location: dict
    viewport: Viewport

class Place(BaseModel):
    formatted_address: str
    geometry: Geometry
    place_id: str
    name: Optional[str] = None
    html_attributions: Optional[List[str]] = []

# Utility function to remove duplicates based on place_id
def remove_duplicates(places: List[Place]) -> List[Place]:
    unique_places = {}
    for place in places:
        # Use place_id as the unique key
        if place.place_id not in unique_places:
            unique_places[place.place_id] = place
    return list(unique_places.values())

# Utility function to chunk the places into groups of 10
def chunk_places(places: List[Place], chunk_size: int = 10) -> List[List[Place]]:
    # Split the places into chunks where each chunk has up to 10 places (1 origin + 8 waypoints + 1 destination)
    return [places[i:i + chunk_size] for i in range(0, len(places), chunk_size - 1)]

# Utility function to create a Google Maps URL using formatted_address
def generate_google_maps_urls(places: List[Place]) -> List[str]:
    if len(places) < 2:
        return []  # At least 2 places (origin and one stop) are required for a route

    # Split the places into chunks, each containing up to 10 places (1 origin + 8 waypoints + 1 destination)
    place_chunks = chunk_places(places)
    
    google_maps_urls = []
    for chunk in place_chunks:
        origin = chunk[0].formatted_address
        destination = chunk[-1].formatted_address
        
        # All the middle places are waypoints
        waypoints = chunk[1:-1]
        waypoints_str = "|".join([place.formatted_address for place in waypoints])
        
        # Create the Google Maps directions link with waypoints using formatted addresses
        google_maps_url = (
            f"https://www.google.com/maps/dir/?api=1&origin={origin}&destination={destination}"
        )
        
        if waypoints_str:
            google_maps_url += f"&waypoints={waypoints_str}"
        
        google_maps_urls.append(google_maps_url)
    
    return google_maps_urls

# Define an endpoint to accept the array of place objects and generate Google Maps URLs
@app.post("/places")
def receive_places(places: List[Place]):
    # Remove duplicates based on place_id
    unique_places = remove_duplicates(places)
    
    # Reverse the list of unique places
    reversed_places = list(reversed(unique_places))
    
    # Write the reversed data to output.json, overwriting the file each time
    with open('output.json', 'w') as json_file:
        json.dump([place.dict() for place in reversed_places], json_file, indent=4)
    
    # Generate the Google Maps URLs for the route chunks using formatted addresses
    google_maps_urls = generate_google_maps_urls(reversed_places)
    
    # Return the reversed list and the array of Google Maps URLs in the response
    return {
        "received_places": reversed_places,
        "google_maps_urls": google_maps_urls
    }


# Example root endpoint
@app.get("/")
def read_root():
    return {"Hello": "World"}

# Example item endpoint
@app.get("/items/{item_id}")
def read_item(item_id: int, q: Optional[str] = None):
    return {"item_id": item_id, "q": q} 