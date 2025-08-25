

import React, { useEffect, useRef } from 'react';
import type { Core } from '../types';
import { MapPin, Droplet, Pencil, LocateFixed, Trash2, Download, Loader2, Compass } from 'lucide-react';

// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';

interface CoreDetailsProps {
  core: Core;
  onEdit: (core: Core) => void;
  onDelete: (coreId: string) => void;
  onGoToMap: () => void;
  onGenerateFullReport: () => void;
  isGeneratingFullReport: boolean;
  onOpenNearbyCores: () => void;
}

const CoreDetails: React.FC<CoreDetailsProps> = ({ core, onEdit, onDelete, onGoToMap, onGenerateFullReport, isGeneratingFullReport, onOpenNearbyCores }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const featureRef = useRef<Feature<Point> | null>(null);

  // Effect to initialize map
  useEffect(() => {
      if (!mapContainerRef.current || mapInstance.current) return;
      
      // Resolve CSS variables to concrete color values for OpenLayers
      const rootStyle = getComputedStyle(document.documentElement);
      const accentPrimaryColor = rootStyle.getPropertyValue('--accent-primary').trim();
      const bgPrimaryColor = rootStyle.getPropertyValue('--bg-primary').trim();
      
      featureRef.current = new Feature(new Point(fromLonLat([0,0])));
      const vectorSource = new VectorSource({ features: [featureRef.current] });

      const map = new Map({
          target: mapContainerRef.current,
          layers: [
              new TileLayer({
                  source: new XYZ({
                      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
                  }),
              }),
               new TileLayer({
                  source: new XYZ({
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
                    attributions: 'Esri, GEBCO, NOAA',
                  }),
                  opacity: 0.7,
              }),
              new VectorLayer({
                  source: vectorSource,
                  style: new Style({
                      image: new Circle({
                          radius: 8,
                          fill: new Fill({ color: accentPrimaryColor || '#22d3ee' }),
                          stroke: new Stroke({ color: bgPrimaryColor || '#0f172a', width: 2 }),
                      }),
                  }),
              })
          ],
          view: new View({
              center: fromLonLat([0, 0]),
              zoom: 2,
              minZoom: 2,
          }),
          controls: defaultControls({
            attribution: false,
            zoom: true,
            rotate: false,
          }),
      });
      mapInstance.current = map;
      
      return () => {
          mapInstance.current?.setTarget(undefined);
          mapInstance.current = null;
      };
  }, []); // Empty dependency array, runs once.

  // Effect to update map when core changes
  useEffect(() => {
      if (mapInstance.current && featureRef.current) {
          const newCenter = fromLonLat([core.location.lon, core.location.lat]);
          mapInstance.current.getView().animate({
              center: newCenter,
              duration: 600,
              zoom: 5,
          });
          (featureRef.current.getGeometry() as Point).setCoordinates(newCenter);
      }
      const timer = setTimeout(() => mapInstance.current?.updateSize(), 310);
      return () => clearTimeout(timer);
  }, [core]);

  return (
    <div className="bg-background-primary p-6 rounded-lg shadow-md border border-border-primary">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h1 className="text-2xl font-bold text-content-primary">{core.id}</h1>
                <p className="text-content-muted">{core.name}</p>
                <p className="text-sm text-content-secondary mt-1">{core.project}</p>
            </div>
            <div className="flex items-center gap-1.5 pt-1 flex-shrink-0">
                  <button
                    onClick={onGenerateFullReport}
                    disabled={isGeneratingFullReport}
                    className="p-2 rounded-md bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors disabled:cursor-wait"
                    aria-label="Download Full Core Report"
                    title="Download Full Core Report"
                  >
                      {isGeneratingFullReport ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  </button>
                   <button
                    onClick={onOpenNearbyCores}
                    className="p-2 rounded-md bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors"
                    aria-label="Find Nearby Cores"
                    title="Find Nearby Cores from NOAA"
                  >
                      <Compass size={18} />
                  </button>
                  <button onClick={() => onEdit(core)} className="p-2 rounded-md bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors" aria-label="Edit Core" title="Edit Core">
                      <Pencil size={18} />
                  </button>
                  <button onClick={() => onDelete(core.id)} className="p-2 rounded-md bg-danger-primary/20 text-danger-primary hover:bg-danger-primary/40 hover:text-content-inverted transition-colors" aria-label="Delete Core" title="Delete Core">
                      <Trash2 size={18} />
                  </button>
              </div>
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-6 justify-between items-start">
            <div className="space-y-3 flex-grow min-w-0">
                <div className="flex items-center text-sm">
                    <MapPin size={16} className="text-accent-secondary mr-3 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-content-primary">Location:</span>
                        <span className="text-content-secondary ml-2">{`${core.location.lat.toFixed(4)}°, ${core.location.lon.toFixed(4)}°`}</span>
                        <button onClick={onGoToMap} className="ml-2 p-1 rounded-md text-content-muted hover:bg-background-interactive hover:text-accent-primary transition-colors" title="Show on map">
                            <LocateFixed size={16}/>
                        </button>
                    </div>
                </div>
                 <div className="flex items-center text-sm">
                    <Droplet size={16} className="text-accent-secondary mr-3 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-content-primary">Water Depth:</span>
                        <span className="text-content-secondary ml-2">{`${core.waterDepth} m`}</span>
                    </div>
                </div>
            </div>
             <div
                ref={mapContainerRef}
                className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-background-secondary border border-border-secondary flex-shrink-0"
                aria-label="Mini-map showing core location"
            >
                {/* Map is rendered here by OpenLayers */}
            </div>
        </div>
    </div>
  );
};

export default CoreDetails;
