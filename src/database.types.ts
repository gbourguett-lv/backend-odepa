export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          role: string;
          thread_id: string;
        };
        Insert: {
          content: Json;
          created_at?: string;
          id?: string;
          role: string;
          thread_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          role?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'chat_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_threads: {
        Row: {
          archived: boolean;
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          created_at?: string;
          id: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      mercados: {
        Row: {
          activo: boolean;
          created_at: string;
          id: number;
          id_region: number;
          nombre: string;
          region: string;
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          id?: number;
          id_region: number;
          nombre: string;
          region: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          id?: number;
          id_region?: number;
          nombre?: string;
          region?: string;
        };
        Relationships: [];
      };
      odepa_market_data_transformed: {
        Row: {
          calidad: string | null;
          created_at: string | null;
          fecha: string;
          id: number;
          id_region: number | null;
          kg_unidad_comercializacion: number | null;
          mercado: string | null;
          origen: string | null;
          precio_kg_unidad_comercializacion: number | null;
          precio_maximo: number | null;
          precio_minimo: number | null;
          precio_promedio_ponderado: number | null;
          producto: string | null;
          region: string | null;
          subsector: string | null;
          total_volume: number | null;
          unidad_comercializacion: string | null;
          updated_at: string | null;
          variedad_tipo: string | null;
          volumen: number | null;
        };
        Insert: {
          calidad?: string | null;
          created_at?: string | null;
          fecha: string;
          id?: number;
          id_region?: number | null;
          kg_unidad_comercializacion?: number | null;
          mercado?: string | null;
          origen?: string | null;
          precio_kg_unidad_comercializacion?: number | null;
          precio_maximo?: number | null;
          precio_minimo?: number | null;
          precio_promedio_ponderado?: number | null;
          producto?: string | null;
          region?: string | null;
          subsector?: string | null;
          total_volume?: number | null;
          unidad_comercializacion?: string | null;
          updated_at?: string | null;
          variedad_tipo?: string | null;
          volumen?: number | null;
        };
        Update: {
          calidad?: string | null;
          created_at?: string | null;
          fecha?: string;
          id?: number;
          id_region?: number | null;
          kg_unidad_comercializacion?: number | null;
          mercado?: string | null;
          origen?: string | null;
          precio_kg_unidad_comercializacion?: number | null;
          precio_maximo?: number | null;
          precio_minimo?: number | null;
          precio_promedio_ponderado?: number | null;
          producto?: string | null;
          region?: string | null;
          subsector?: string | null;
          total_volume?: number | null;
          unidad_comercializacion?: string | null;
          updated_at?: string | null;
          variedad_tipo?: string | null;
          volumen?: number | null;
        };
        Relationships: [];
      };
      productos: {
        Row: {
          created_at: string;
          id: number;
          nombre: string;
          subsector: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          nombre: string;
          subsector?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          nombre?: string;
          subsector?: string | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          ai_config: Json;
          created_at: string;
          messages_today: number;
          messages_today_date: string;
          preferred_model: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_config?: Json;
          created_at?: string;
          messages_today?: number;
          messages_today_date?: string;
          preferred_model?: string;
          role?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_config?: Json;
          created_at?: string;
          messages_today?: number;
          messages_today_date?: string;
          preferred_model?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      variedades: {
        Row: {
          activo: boolean;
          created_at: string;
          grupo: string | null;
          id: number;
          nombre_mostrar: string | null;
          producto: string;
          registros: number | null;
          updated_at: string;
          variedad_tipo: string;
        };
        Insert: {
          activo?: boolean;
          created_at?: string;
          grupo?: string | null;
          id?: number;
          nombre_mostrar?: string | null;
          producto: string;
          registros?: number | null;
          updated_at?: string;
          variedad_tipo: string;
        };
        Update: {
          activo?: boolean;
          created_at?: string;
          grupo?: string | null;
          id?: number;
          nombre_mostrar?: string | null;
          producto?: string;
          registros?: number | null;
          updated_at?: string;
          variedad_tipo?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
