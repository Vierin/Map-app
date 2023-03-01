import mapboxgl from 'mapbox-gl';
import axios from 'axios/dist/axios';
import {tsvJSON} from "./modules/MapData.utils";

const url = "https://docs.google.com/spreadsheets/d/1Y-EWKx9n6vwL2IUiaHfQh81qTlTGtc8laSMd9mPwnys/pub?output=tsv";

const token = 'pk.eyJ1IjoibWlrb2xhai1odW5jd290IiwiYSI6ImNram1wNWZodDZlOHcyc2xnYmF0ODlpeXcifQ.svOUXdAo7D73Wloj7laAUA';

export interface IMapSettings {
    lat: number;
    lng: number;
    zoom?: number;
    style?: mapboxgl.Style | string;
    scroll?: boolean;
    token?: string;
    renderWorldCopies?: boolean;
    interactive?: boolean;
    touchZoomRotate?: boolean;
    minZoom?: number;
    maxZoom?: number;
    dragRotate?: boolean;
}

export type Marker = {
    name: string;
    category: string;
    description: string;
    url: string;
    loc?: string;
    lat: string;
    lon: string;
}

class Main {
    private settings: IMapSettings;
    private map: mapboxgl.Map;
    private dataItems: Array<Marker>;
    private currentMarker: Marker;
    private sidebar: HTMLElement;
    private amount: HTMLElement;
    private current: HTMLElement;
    private arrPrev: HTMLElement;
    private arrNext: HTMLElement;
    private close: HTMLElement;
    private currentId: number;

    constructor() {
        this.settings = {
            lng: -20,
            lat: 35,
            zoom: 2.2,
            interactive: true,
            renderWorldCopies: false,
            touchZoomRotate: true,
            style: 'mapbox://styles/mikolaj-huncwot/clems2gum00a801nt6gkck9b3',
            maxZoom: 6,
            dragRotate: false,
            // @ts-ignore
            maxBounds: [[-169, -69], [168, 82]],
            token
        };

        this.amount = document.querySelector('.js-amount');
        this.current = document.querySelector('.js-curr');
        this.arrPrev = document.querySelector('.js-prev');
        this.arrNext = document.querySelector('.js-next');
        this.close = document.querySelector('.js-close');
        this.sidebar = document.querySelector('.js-wrap');

        this.initMap();
        this.init();
    }

    private init = async () => {
        await this.load();
        this.addMarkers();
    }

    private load = async () => {

        try {
            const { data } = await axios.get(url);
            this.dataItems = tsvJSON(data);  
        } catch (error) {
            throw new Error(error);
        }

        this.amount.innerHTML = `/${this.dataItems.length}`;
    }

    private initMap(): void {
        const mapWrap = document.querySelector('[data-module]') as HTMLElement;

        mapboxgl.accessToken = token;

        this.map = new mapboxgl.Map({
            container: mapWrap,
            style: this.settings.style,
            center: [this.settings.lng, this.settings.lat],
            zoom: this.settings.zoom,
            renderWorldCopies: this.settings.renderWorldCopies,
            interactive: this.settings.interactive,
            dragRotate: false,
            touchZoomRotate: this.settings.touchZoomRotate,
            // @ts-ignore
            maxBounds: this.settings.maxBounds,
        });
    }

    private addMarkers(): void {

        [...this.dataItems].map(el => {
            const marker = new mapboxgl.Marker(
                { 
                    "color": "#000", 
                    "scale": 1.5,
                    "clickTolerance": 1
                })
                .setLngLat([+el.lon, +el.lat])
                .addTo(this.map);

            
            //center on click
            marker.getElement().addEventListener('click', () => {
                this.toggleActive(marker);

                this.map.flyTo({
                    center: marker.getLngLat(),
                    speed: 0.1,
                    zoom: 3
                });
            });
        })
    }

    private toggleActive(marker: mapboxgl.Marker): void {
        document.querySelectorAll('.mapboxgl-marker').forEach(el => {
            el.classList.remove('is-active');
        });

        marker.getElement().classList.add('is-active');
    }

    private setSidebar(el: Marker): void {
        this.currentMarker = el;

        // current number
        this.getKey(el);
        console.log('set');
        

        this.current.innerHTML = `${this.currentId}`;
              
        this.sidebar.parentElement.classList.add('is-shown');

        this.sidebar.innerHTML = `
            <div class="sidebar-item__head">
                <div class="sidebar-item__img">
                    <img src="https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${el.lon},${el.lat},14/360x170?access_token=${token}" alt="" />
                    <span class="sidebar-item__marker"><img class="pin" src="./media/pin.png" alt="pin" /></span>
                </div>
                <h6 class="sidebar-item__title">${el.name}</h6>
                <p class="sidebar-item__category">${el.category}</p>
            </div>
            <p class="sidebar-item__desc">${el.description}</p>
            <a href="${el.url}" class="sidebar-item__url" target="_blank">
                <span><img src="./media/ext-link.png" alt="link"/></span>    
                ${el.url}
            </a>
        `;

        
        
        this.sidebarHandler();
    }

    private getKey(el: Marker): void {
        [...this.dataItems].map((e, key) => {
            if(el === e) {
                this.currentId = key;
            }
        })
    }

    private sidebarHandler(): void {

        this.close.addEventListener('click', () => {
            this.sidebar.parentElement.classList.remove('is-shown');
        });

        this.arrNext.addEventListener('click', () => this.onArrClick(-1));
        this.arrPrev.addEventListener('click', () => this.onArrClick(1));
    }

    private onArrClick(num: number): void {
        console.log(this.currentId + num);
        
        this.setSidebar(this.dataItems[this.currentId + num]);
    }
}

const app = new Main();