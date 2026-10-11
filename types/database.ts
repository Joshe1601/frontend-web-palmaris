export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          nombre: string
          created_at: string
        }
        Insert: {
          id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          nombre: string
          created_at?: string
        }
        Update: {
          id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          nombre?: string
          created_at?: string
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          id: boolean
          almacen_lat: number | null
          almacen_lng: number | null
          velocidad_promedio_kmh: number
          tiempo_atencion_min: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          almacen_lat?: number | null
          almacen_lng?: number | null
          velocidad_promedio_kmh?: number
          tiempo_atencion_min?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          almacen_lat?: number | null
          almacen_lng?: number | null
          velocidad_promedio_kmh?: number
          tiempo_atencion_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          nombre: string
          direccion: string
          lat: number | null
          lng: number | null
          zona: string | null
          vendedor_id: string | null
          ventana_horario_inicio: string | null
          ventana_horario_fin: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          direccion: string
          lat?: number | null
          lng?: number | null
          zona?: string | null
          vendedor_id?: string | null
          ventana_horario_inicio?: string | null
          ventana_horario_fin?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          direccion?: string
          lat?: number | null
          lng?: number | null
          zona?: string | null
          vendedor_id?: string | null
          ventana_horario_inicio?: string | null
          ventana_horario_fin?: string | null
          activo?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      choferes: {
        Row: {
          id: string
          nombre: string
          usuario: string
          telefono: string | null
          auth_user_id: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          usuario: string
          telefono?: string | null
          auth_user_id?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          usuario?: string
          telefono?: string | null
          auth_user_id?: string | null
          activo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      vehiculos: {
        Row: {
          id: string
          placa: string
          alias: string | null
          capacidad_kg: number | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          placa: string
          alias?: string | null
          capacidad_kg?: number | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          placa?: string
          alias?: string | null
          capacidad_kg?: number | null
          activo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          id: string
          cliente_id: string
          vendedor_id: string | null
          estado: Database["public"]["Enums"]["estado_pedido"]
          peso_kg: number | null
          fecha_pedido: string
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          vendedor_id?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          peso_kg?: number | null
          fecha_pedido?: string
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          vendedor_id?: string | null
          estado?: Database["public"]["Enums"]["estado_pedido"]
          peso_kg?: number | null
          fecha_pedido?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rutas: {
        Row: {
          id: string
          fecha: string
          chofer_id: string
          vehiculo_id: string
          zona: string | null
          estado: Database["public"]["Enums"]["estado_ruta"]
          distancia_km: number | null
          tiempo_estimado_min: number | null
          iniciada_at: string | null
          finalizada_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          fecha: string
          chofer_id: string
          vehiculo_id: string
          zona?: string | null
          estado?: Database["public"]["Enums"]["estado_ruta"]
          distancia_km?: number | null
          tiempo_estimado_min?: number | null
          iniciada_at?: string | null
          finalizada_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          fecha?: string
          chofer_id?: string
          vehiculo_id?: string
          zona?: string | null
          estado?: Database["public"]["Enums"]["estado_ruta"]
          distancia_km?: number | null
          tiempo_estimado_min?: number | null
          iniciada_at?: string | null
          finalizada_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rutas_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      paradas: {
        Row: {
          id: string
          ruta_id: string
          cliente_id: string
          orden: number
          estado: Database["public"]["Enums"]["estado_parada"]
          distancia_desde_anterior_km: number | null
          tiempo_estimado_min: number | null
          hora_estimada_llegada: string | null
          advertencia_ventana: boolean
          motivo_rechazo: string | null
          marcada_at: string | null
        }
        Insert: {
          id?: string
          ruta_id: string
          cliente_id: string
          orden: number
          estado?: Database["public"]["Enums"]["estado_parada"]
          distancia_desde_anterior_km?: number | null
          tiempo_estimado_min?: number | null
          hora_estimada_llegada?: string | null
          advertencia_ventana?: boolean
          motivo_rechazo?: string | null
          marcada_at?: string | null
        }
        Update: {
          id?: string
          ruta_id?: string
          cliente_id?: string
          orden?: number
          estado?: Database["public"]["Enums"]["estado_parada"]
          distancia_desde_anterior_km?: number | null
          tiempo_estimado_min?: number | null
          hora_estimada_llegada?: string | null
          advertencia_ventana?: boolean
          motivo_rechazo?: string | null
          marcada_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paradas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      parada_pedidos: {
        Row: {
          parada_id: string
          pedido_id: string
        }
        Insert: {
          parada_id: string
          pedido_id: string
        }
        Update: {
          parada_id?: string
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parada_pedidos_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "paradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parada_pedidos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      ubicaciones: {
        Row: {
          id: number
          chofer_id: string
          ruta_id: string
          lat: number
          lng: number
          precision_m: number | null
          registrado_at: string
        }
        Insert: {
          id?: never
          chofer_id: string
          ruta_id: string
          lat: number
          lng: number
          precision_m?: number | null
          registrado_at?: string
        }
        Update: {
          id?: never
          chofer_id?: string
          ruta_id?: string
          lat?: number
          lng?: number
          precision_m?: number | null
          registrado_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ubicaciones_chofer_id_fkey"
            columns: ["chofer_id"]
            isOneToOne: false
            referencedRelation: "choferes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubicaciones_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      chofer_actual_id: {
        Args: never
        Returns: string
      }
      es_admin: {
        Args: never
        Returns: boolean
      }
      crear_ruta_con_paradas: {
        Args: {
          p_chofer_id: string
          p_distancia_km: number
          p_fecha: string
          p_paradas: Json
          p_tiempo_estimado_min: number
          p_vehiculo_id: string
          p_zona: string
        }
        Returns: string
      }
      iniciar_ruta: {
        Args: {
          p_ruta_id: string
        }
        Returns: undefined
      }
      marcar_parada: {
        Args: {
          p_estado: Database["public"]["Enums"]["estado_parada"]
          p_parada_id: string
          p_motivo?: string
        }
        Returns: Json
      }
    }
    Enums: {
      estado_parada: "pendiente" | "entregado" | "rechazado"
      estado_pedido: "pendiente" | "entregado" | "rechazado" | "pospuesto" | "cancelado"
      estado_ruta: "pendiente" | "en_curso" | "finalizada"
      rol_usuario: "admin" | "chofer" | "vendedor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Update"]

export type Enums<
  EnumName extends keyof DefaultSchema["Enums"],
> = DefaultSchema["Enums"][EnumName]

export const Constants = {
  public: {
    Enums: {
      estado_parada: ["pendiente", "entregado", "rechazado"],
      estado_pedido: ["pendiente", "entregado", "rechazado", "pospuesto", "cancelado"],
      estado_ruta: ["pendiente", "en_curso", "finalizada"],
      rol_usuario: ["admin", "chofer", "vendedor"],
    },
  },
} as const
